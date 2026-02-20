/**
 * @module examBank/generateExamBankQuestions
 * @description Firebase callable: generates exam-specific SBA questions for a
 * given exam type using Claude (Anthropic API) and the official exam syllabus
 * blueprint — no uploaded materials required.
 *
 * Questions are stored in `users/{uid}/examBank/{examType}` and cycled across
 * coverage blueprint domains on repeated calls.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const { EXPLORE_QUESTIONS_SYSTEM, exploreQuestionsUserPrompt } = require("../ai/prompts");
const { normaliseQuestion } = require("../lib/serialize");
const { EXAM_PLAYBOOKS, buildExamPlaybookPrompt, normalizeExamType } = require("../ai/examPlaybooks");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const MAX_STORED_QUESTIONS = 100;
const DEFAULT_COUNT = 10;

/** Maps each exam type to its default MedQ assessment level. */
const EXAM_DEFAULT_LEVELS = {
  PLAB1:       "MD3",
  PLAB2:       "MD3",
  MRCP_PART1:  "MD4",
  MRCP_PACES:  "MD4",
  MRCGP_AKT:   "MD3",
  USMLE_STEP1: "MD3",
  USMLE_STEP2: "MD4",
  FINALS:      "MD3",
  SBA:         "MD3",
  OSCE:        "MD3",
};

// ── Stem deduplication ───────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "have", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "then", "there", "these", "this", "to", "was", "were", "which",
  "with", "patient", "most", "likely", "following", "best", "next", "step",
  "year", "old", "man", "woman", "male", "female", "presents", "presents",
]);

function stemTokens(stem) {
  return String(stem || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function stemSimilarity(a, b) {
  const tA = stemTokens(a);
  const tB = stemTokens(b);
  if (!tA.length || !tB.length) return 0;
  const setA = new Set(tA);
  let overlap = 0;
  for (const t of tB) if (setA.has(t)) overlap++;
  return overlap / Math.max(setA.size, tB.length);
}

function isDuplicate(stem, existingStems) {
  return existingStems.some((s) => stemSimilarity(stem, s) >= 0.68);
}

// ── Domain cycling ───────────────────────────────────────────────────────────

/**
 * Select the next blueprint domain that has not been used in the most recent
 * window of generations, cycling back when all domains have been covered.
 */
function selectNextDomain(playbook, domainsGenerated) {
  const blueprint = Array.isArray(playbook.coverageBlueprint) && playbook.coverageBlueprint.length > 0
    ? playbook.coverageBlueprint
    : ["Core clinical medicine"];

  // Avoid domains used in the most recent (blueprint.length - 1) calls
  const recentWindow = domainsGenerated.slice(-(blueprint.length - 1));
  const fresh = blueprint.find((d) => !recentWindow.includes(d));
  if (fresh) return fresh;

  // All domains recently used — cycle back to the least-recently used
  return blueprint[domainsGenerated.length % blueprint.length];
}

// ── Cloud Function ───────────────────────────────────────────────────────────

exports.generateExamBankQuestions = functions
  .runWith({
    timeoutSeconds: 180,
    memory: "512MB",
    // Gemini = primary generator; Claude = fallback (both secrets needed)
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const t0 = Date.now();
    const uid = requireAuth(context);

    // Validate exam type
    const rawExamType = String(data.examType || "").trim().toUpperCase();
    const examType = normalizeExamType(rawExamType);
    if (!examType || examType === "SBA" && !rawExamType) {
      return fail(Errors.INVALID_ARGUMENT, "examType is required.");
    }

    const count = requireInt(data, "count", 3, 20, DEFAULT_COUNT);

    await checkRateLimit(uid, "generateExamBankQuestions", RATE_LIMITS.generateExamBankQuestions);

    // Resolve exam configuration
    const playbook = EXAM_PLAYBOOKS[examType] || EXAM_PLAYBOOKS["SBA"];
    const levelId = EXAM_DEFAULT_LEVELS[examType] || "MD3";
    const levelProfile = getAssessmentLevel(levelId);

    // Read existing bank doc
    const examBankRef = db.doc(`users/${uid}/examBank/${examType}`);
    let existingDoc = null;
    try {
      const snap = await examBankRef.get();
      existingDoc = snap.exists ? snap.data() : null;
    } catch (err) {
      log.warn("Exam bank read failed — proceeding fresh", {
        uid, examType, error: err.message,
      });
    }

    const existingQuestions = Array.isArray(existingDoc?.questions) ? existingDoc.questions : [];
    const domainsGenerated = Array.isArray(existingDoc?.domainsGenerated) ? existingDoc.domainsGenerated : [];

    // Select next domain to cover
    const domain = selectNextDomain(playbook, domainsGenerated);

    // Build exclusion stems from the most recently stored questions
    const excludeStems = existingQuestions
      .slice(-8)
      .map((q) => String(q?.stem || "").trim())
      .filter(Boolean);

    log.info("Generating exam bank questions", {
      uid, examType, domain, levelId, count,
      existingCount: existingQuestions.length,
    });

    try {
      // Build prompt — inject exam playbook as learnedContext so Claude knows
      // the official exam coverage blueprint, question construction rules, and
      // clinical reasoning requirements for this specific exam.
      const userPrompt = exploreQuestionsUserPrompt({
        topic: domain,
        count,
        levelLabel: levelProfile.label,
        levelDescription: levelProfile.description,
        minDifficulty: levelProfile.minDifficulty,
        maxDifficulty: levelProfile.maxDifficulty,
        hardFloorCount: Math.ceil(count * 0.3),
        expertFloorCount: 0,
        conciseMode: true,
        strictMode: levelProfile.id === "MD4" || levelProfile.id === "MD5",
        learnedContext: buildExamPlaybookPrompt(examType),
        excludeStems,
      });

      // Primary: Gemini (fast, low latency). Claude guides via learnedContext in prompt.
      const geminiOpts = {
        maxTokens: 3800,
        retries: 1,
        temperature: 0.12,
        rateLimitMaxRetries: 1,
        rateLimitRetryDelayMs: 2500,
      };
      let generationResult = await geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt, geminiOpts);
      let modelUsed = "gemini";

      // Fallback: Claude if Gemini fails or returns nothing
      if (!generationResult.success || !Array.isArray(generationResult.data?.questions) || generationResult.data.questions.length === 0) {
        log.warn("Gemini exam bank generation failed, falling back to Claude", {
          uid, examType, domain, geminiError: generationResult.error,
        });
        const claudeOpts = { maxTokens: 4200, retries: 1, usePrefill: false };
        generationResult = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt, claudeOpts);
        modelUsed = "claude-fallback";
      }

      const rawQuestions = Array.isArray(generationResult.data?.questions) ? generationResult.data.questions : [];

      if (rawQuestions.length === 0) {
        return fail(Errors.AI_FAILED, "No questions returned. Please try again.");
      }

      // Normalise (snake_case → camelCase, type enforcement, defaults)
      const stamp = Date.now();
      const defaults = {
        fileId: "exam-bank",
        fileName: `${examType} Exam Bank`,
        sectionId: "exam-bank",
        sectionTitle: domain,
      };

      const normalised = rawQuestions
        .map((q) => normaliseQuestion(q, defaults))
        .filter((q) => q && q.stem && Array.isArray(q.options) && q.options.length >= 4);

      // Stamp unique IDs (normaliseQuestion does not add an id field)
      const stamped = normalised.map((q, i) => ({
        ...q,
        id: `exambank_${examType}_${stamp}_${i}`,
      }));

      // Deduplicate against existing bank
      const existingStems = existingQuestions.map((q) => String(q?.stem || ""));
      const uniqueNew = stamped.filter((q) => !isDuplicate(q.stem, existingStems));

      // Merge, cap, persist
      const merged = [...existingQuestions, ...uniqueNew].slice(-MAX_STORED_QUESTIONS);
      const updatedDomains = [...domainsGenerated, domain].slice(-50);

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Write each new question to the individual questions collection so
      // submitAttempt can look them up by ID (it reads users/{uid}/questions/{id}).
      const batch = db.batch();
      for (const q of uniqueNew) {
        const qRef = db.doc(`users/${uid}/questions/${q.id}`);
        batch.set(qRef, {
          ...q,
          courseId: examType,
          createdAt: now,
        });
      }

      batch.set(
        examBankRef,
        {
          questions: merged,
          examType,
          totalCount: merged.length,
          domainsGenerated: updatedDomains,
          lastGeneratedAt: now,
          updatedAt: now,
          ...(existingDoc ? {} : { createdAt: now }),
        },
        { merge: true }
      );

      await batch.commit();

      log.info("Exam bank questions generated", {
        uid, examType, domain, levelId,
        newCount: uniqueNew.length,
        totalCount: merged.length,
        durationMs: Date.now() - t0,
      });

      return ok({
        questions: uniqueNew,
        totalCount: merged.length,
        domain,
        examType,
        modelUsed,
      });
    } catch (error) {
      log.error("Exam bank generation failed", {
        uid, examType, domain, error: error.message,
      });
      return safeError(error, "exam bank question generation");
    }
  });
