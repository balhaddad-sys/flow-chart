/**
 * @module explore/exploreTopicInsight
 * @description Callable function that returns a high-yield topic briefing for Explore.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { ok, fail, Errors, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { sanitizeText } = require("../lib/sanitize");
const { truncate } = require("../lib/utils");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { buildExploreProfileDocId } = require("./exploreLearningProfile");
const {
  EXPLORE_TOPIC_INSIGHT_SYSTEM,
  exploreTopicInsightUserPrompt,
} = require("../ai/prompts");
const { buildExamPlaybookPrompt } = require("../ai/examPlaybooks");
const { lookupInsight, writeInsight } = require("../cache/knowledgeCache");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const MAX_TOPIC_LEN = 200;
const MAX_SUMMARY_LEN = 6_000;
const MAX_LIST_ITEMS = 12;
const MAX_FRAMEWORK_TEXT_LEN = 3_000;
const MAX_GUIDELINE_UPDATES = 10;
const MAX_TEACHING_SECTIONS = 8;
const MAX_SECTION_CONTENT_LEN = 3_000;
const MAX_SECTION_KEY_POINTS = 5;
const MAX_CHART_DATA_POINTS = 12;
const MAX_ALGORITHM_STEPS = 15;
const GEMINI_TIMEOUT_MS = 55_000;
const CLAUDE_TIMEOUT_MS = 65_000;

function withTimeout(taskPromise, timeoutMs, timeoutLabel) {
  return Promise.race([
    taskPromise,
    new Promise((resolve) => {
      setTimeout(
        () => resolve({ success: false, error: `${timeoutLabel} timed out after ${timeoutMs}ms` }),
        timeoutMs
      );
    }),
  ]);
}

function normaliseCitationSource(rawSource) {
  const source = String(rawSource || "").toLowerCase().trim();
  if (source.includes("pubmed")) return "PubMed";
  if (source.includes("uptodate") || source.includes("up to date")) return "UpToDate";
  if (source.includes("medscape")) return "Medscape";
  return "PubMed";
}

function buildSearchUrl(source, topic) {
  const query = encodeURIComponent(String(topic || "medical topic").slice(0, 120));
  switch (source) {
    case "UpToDate":
      return `https://www.uptodate.com/contents/search?search=${query}`;
    case "Medscape":
      return `https://www.medscape.com/search?queryText=${query}`;
    case "PubMed":
    default:
      return `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`;
  }
}

function normaliseStringList(input, { maxItems = MAX_LIST_ITEMS, maxLen = 260 } = {}) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => truncate(sanitizeText(item || ""), maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseGuidelineYear(rawYear) {
  if (rawYear == null) return null;
  const currentYear = new Date().getFullYear();
  const minYear = Math.max(1990, currentYear - 30);
  const maxYear = currentYear + 1;

  if (typeof rawYear === "number" && Number.isFinite(rawYear)) {
    const year = Math.floor(rawYear);
    return year >= minYear && year <= maxYear ? year : null;
  }

  const rawText = String(rawYear || "").trim();
  const match = rawText.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= minYear && year <= maxYear ? year : null;
}

function normaliseGuidelineStrength(rawStrength) {
  const text = String(rawStrength || "").toLowerCase().trim();
  if (!text) return "MODERATE";
  if (text.includes("high") || text.includes("strong") || text === "a") return "HIGH";
  if (text.includes("emerging") || text.includes("limited") || text.includes("low")) return "EMERGING";
  return "MODERATE";
}

function strengthToImpactScore(strength) {
  switch (String(strength || "").toUpperCase()) {
    case "HIGH":
      return 5;
    case "EMERGING":
      return 2;
    case "MODERATE":
    default:
      return 3;
  }
}

function normaliseClinicalFramework(rawFramework) {
  const pathophysiology = truncate(
    sanitizeText(
      rawFramework?.pathophysiology ||
      rawFramework?.mechanism ||
      ""
    ),
    MAX_FRAMEWORK_TEXT_LEN
  );
  const diagnosticApproach = normaliseStringList(
    rawFramework?.diagnostic_approach || rawFramework?.diagnosticApproach,
    { maxItems: 7, maxLen: 260 }
  );
  const managementApproach = normaliseStringList(
    rawFramework?.management_approach || rawFramework?.managementApproach,
    { maxItems: 7, maxLen: 260 }
  );
  const escalationTriggers = normaliseStringList(
    rawFramework?.escalation_triggers || rawFramework?.escalationTriggers,
    { maxItems: 6, maxLen: 220 }
  );

  return {
    pathophysiology,
    diagnosticApproach,
    managementApproach,
    escalationTriggers,
  };
}

function normaliseGuidelineUpdates(rawUpdates) {
  if (!Array.isArray(rawUpdates)) return [];
  const updates = [];
  const seen = new Set();

  for (const item of rawUpdates.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const source = normaliseCitationSource(item.source);
    const title = truncate(sanitizeText(item.title || item.label || ""), 220);
    if (!title) continue;

    const key = `${source}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const year = normaliseGuidelineYear(item.year || item.publishedYear || item.published_at);
    const keyChange = truncate(sanitizeText(item.key_change || item.keyChange || ""), 260);
    const practiceImpact = truncate(
      sanitizeText(item.practice_impact || item.practiceImpact || ""),
      260
    );
    const strength = normaliseGuidelineStrength(item.strength || item.evidence || item.grade);
    const impactScore = Math.max(
      1,
      Math.min(5, Math.floor(Number(item.impact_score || item.impactScore) || strengthToImpactScore(strength)))
    );

    updates.push({
      year,
      source,
      title,
      keyChange,
      practiceImpact,
      strength,
      impactScore,
      url: buildSearchUrl(source, year ? `${title} ${year}` : title),
    });
  }

  return updates
    .sort((a, b) => {
      const yearA = a.year || 0;
      const yearB = b.year || 0;
      if (yearA !== yearB) return yearB - yearA;
      return b.impactScore - a.impactScore;
    })
    .slice(0, MAX_GUIDELINE_UPDATES);
}

function normaliseCitations(rawCitations, topic) {
  const citations = [];
  const seen = new Set();

  const input = Array.isArray(rawCitations) ? rawCitations.slice(0, 8) : [];
  for (const item of input) {
    if (!item) continue;
    const title = truncate(sanitizeText(item.title || item.label || ""), 260);
    if (!title) continue;
    const source = normaliseCitationSource(item.source);
    const key = `${source}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      source,
      title,
      url: buildSearchUrl(source, title),
    });
    if (citations.length >= 8) break;
  }

  if (citations.length > 0) return citations;

  const fallbackTopic = truncate(sanitizeText(topic || "medical topic"), 90);
  return [
    {
      source: "PubMed",
      title: `PubMed: ${fallbackTopic}`,
      url: buildSearchUrl("PubMed", fallbackTopic),
    },
    {
      source: "UpToDate",
      title: `UpToDate: ${fallbackTopic}`,
      url: buildSearchUrl("UpToDate", fallbackTopic),
    },
    {
      source: "Medscape",
      title: `Medscape: ${fallbackTopic}`,
      url: buildSearchUrl("Medscape", fallbackTopic),
    },
  ];
}

function normaliseTeachingSections(rawSections) {
  if (!Array.isArray(rawSections)) return [];
  const sections = [];
  const seenIds = new Set();

  for (const item of rawSections.slice(0, MAX_TEACHING_SECTIONS)) {
    if (!item || typeof item !== "object") continue;
    const id = sanitizeText(item.id || `section-${sections.length}`).slice(0, 50);
    const title = truncate(sanitizeText(item.title || ""), 200);
    if (!title) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const content = truncate(sanitizeText(item.content || ""), MAX_SECTION_CONTENT_LEN);
    const keyPoints = normaliseStringList(item.key_points || item.keyPoints, {
      maxItems: MAX_SECTION_KEY_POINTS,
      maxLen: 320,
    });

    if (!content && keyPoints.length === 0) continue;
    sections.push({ id, title, content, keyPoints });
  }
  return sections;
}

function normaliseChartDataPoints(rawPoints) {
  if (!Array.isArray(rawPoints)) return [];
  return rawPoints
    .slice(0, MAX_CHART_DATA_POINTS)
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const label = truncate(sanitizeText(p.label || ""), 100);
      const value = Number(p.value);
      if (!label || !Number.isFinite(value)) return null;
      const unit = truncate(sanitizeText(p.unit || ""), 30);
      return { label, value, unit };
    })
    .filter(Boolean);
}

function normaliseAlgorithmSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  const validTypes = new Set(["decision", "action", "endpoint"]);
  return rawSteps
    .slice(0, MAX_ALGORITHM_STEPS)
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const id = sanitizeText(s.id || "").slice(0, 50);
      const label = truncate(sanitizeText(s.label || ""), 200);
      if (!id || !label) return null;
      const type = validTypes.has(s.type) ? s.type : "action";
      return {
        id,
        label,
        type,
        yesNext: s.yes_next || s.yesNext || null,
        noNext: s.no_next || s.noNext || null,
        next: s.next || null,
      };
    })
    .filter(Boolean);
}

function normaliseChartData(rawChartData, topic) {
  if (!rawChartData || typeof rawChartData !== "object") return {};
  const result = {};

  const epi = rawChartData.epidemiology;
  if (epi && typeof epi === "object") {
    const dataPoints = normaliseChartDataPoints(epi.data_points || epi.dataPoints);
    if (dataPoints.length > 0) {
      result.epidemiology = {
        title: truncate(sanitizeText(epi.title || "Epidemiology"), 200),
        type: epi.type === "horizontal_bar" ? "horizontal_bar" : "bar",
        xLabel: truncate(sanitizeText(epi.x_label || epi.xLabel || ""), 80),
        yLabel: truncate(sanitizeText(epi.y_label || epi.yLabel || ""), 80),
        dataPoints,
        sourceCitation: truncate(sanitizeText(epi.source_citation || epi.sourceCitation || ""), 300),
        sourceUrl: buildSearchUrl("PubMed", epi.source_url_hint || epi.sourceUrlHint || topic),
      };
    }
  }

  const tx = rawChartData.treatment_comparison || rawChartData.treatmentComparison;
  if (tx && typeof tx === "object") {
    const categories = normaliseStringList(tx.categories, { maxItems: 8, maxLen: 100 });
    const rawSeries = Array.isArray(tx.series) ? tx.series.slice(0, 4) : [];
    const series = rawSeries
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const name = truncate(sanitizeText(s.name || ""), 100);
        const values = (Array.isArray(s.values) ? s.values : [])
          .slice(0, categories.length)
          .map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
        if (!name || values.length === 0) return null;
        return { name, values };
      })
      .filter(Boolean);

    if (categories.length > 0 && series.length > 0) {
      result.treatmentComparison = {
        title: truncate(sanitizeText(tx.title || "Treatment Comparison"), 200),
        type: tx.type === "grouped_bar" ? "grouped_bar" : "bar",
        categories,
        series,
        unit: truncate(sanitizeText(tx.unit || "%"), 30),
        sourceCitation: truncate(sanitizeText(tx.source_citation || tx.sourceCitation || ""), 300),
        sourceUrl: buildSearchUrl("PubMed", tx.source_url_hint || tx.sourceUrlHint || topic),
      };
    }
  }

  const algo = rawChartData.diagnostic_algorithm || rawChartData.diagnosticAlgorithm;
  if (algo && typeof algo === "object") {
    const steps = normaliseAlgorithmSteps(algo.steps);
    if (steps.length > 0) {
      result.diagnosticAlgorithm = {
        title: truncate(sanitizeText(algo.title || "Diagnostic Algorithm"), 200),
        steps,
        sourceCitation: truncate(sanitizeText(algo.source_citation || algo.sourceCitation || ""), 300),
      };
    }
  }

  const prog = rawChartData.prognostic_data || rawChartData.prognosticData;
  if (prog && typeof prog === "object") {
    const dataPoints = normaliseChartDataPoints(prog.data_points || prog.dataPoints);
    if (dataPoints.length > 0) {
      result.prognosticData = {
        title: truncate(sanitizeText(prog.title || "Prognostic Data"), 200),
        type: "bar",
        dataPoints,
        sourceCitation: truncate(sanitizeText(prog.source_citation || prog.sourceCitation || ""), 300),
        sourceUrl: buildSearchUrl("PubMed", prog.source_url_hint || prog.sourceUrlHint || topic),
      };
    }
  }

  return result;
}

function normaliseInsightPayload(raw, topic) {
  const summary = truncate(
    sanitizeText(raw?.summary || raw?.overview || ""),
    MAX_SUMMARY_LEN
  );
  const clinicalFramework = normaliseClinicalFramework(
    raw?.clinical_framework || raw?.clinicalFramework || {}
  );
  const teachingSections = normaliseTeachingSections(
    raw?.teaching_sections || raw?.teachingSections || []
  );
  const chartData = normaliseChartData(
    raw?.chart_data || raw?.chartData || {},
    topic
  );
  const corePoints = normaliseStringList(raw?.core_points || raw?.corePoints || raw?.key_points || raw?.keyPoints, {
    maxItems: 12,
    maxLen: 320,
  });
  const clinicalPitfalls = normaliseStringList(raw?.clinical_pitfalls || raw?.pitfalls, {
    maxItems: 6,
    maxLen: 240,
  });
  const redFlags = normaliseStringList(raw?.red_flags || raw?.redFlags, {
    maxItems: 6,
    maxLen: 220,
  });
  const studyApproach = normaliseStringList(raw?.study_approach || raw?.studyApproach || raw?.next_steps, {
    maxItems: 6,
    maxLen: 220,
  });
  const guidelineUpdates = normaliseGuidelineUpdates(
    raw?.guideline_updates || raw?.guidelineUpdates
  );
  const citations = normaliseCitations(raw?.citations, topic);

  const hasFrameworkContent =
    !!clinicalFramework.pathophysiology ||
    clinicalFramework.diagnosticApproach.length > 0 ||
    clinicalFramework.managementApproach.length > 0;
  if (!summary && corePoints.length === 0 && !hasFrameworkContent && teachingSections.length === 0) return null;

  return {
    summary,
    teachingSections,
    corePoints,
    clinicalFramework,
    chartData,
    clinicalPitfalls,
    redFlags,
    studyApproach,
    guidelineUpdates,
    citations,
  };
}

exports.exploreTopicInsight = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "topic", maxLen: MAX_TOPIC_LEN },
      { field: "level", maxLen: 20 },
    ]);

    await checkRateLimit(uid, "exploreTopicInsight", RATE_LIMITS.exploreTopicInsight);

    const topic = String(data.topic || "").trim();
    const examType = typeof data.examType === "string" ? data.examType.trim().slice(0, 40) : null;
    const questionContext = typeof data.questionContext === "string"
      ? data.questionContext.trim().slice(0, 800)
      : "";
    const levelProfile = getAssessmentLevel(data.level);
    const hasQuestionContext = Boolean(questionContext);

    // ── Knowledge Cache lookup (skip when question-specific) ──────────
    if (!hasQuestionContext) {
      try {
        const insightCache = await lookupInsight(topic, levelProfile.id, examType);
        if (insightCache.hit) {
          // Update explore profile with cached data (same as live generation)
          try {
            const profileDocId = buildExploreProfileDocId(topic, levelProfile.id);
            const profileRef = db.doc(`users/${uid}/exploreProfiles/${profileDocId}`);
            const focusTags = normaliseStringList(
              []
                .concat(insightCache.insight.corePoints || [])
                .concat(insightCache.insight.clinicalFramework?.diagnosticApproach || [])
                .concat(insightCache.insight.clinicalFramework?.managementApproach || []),
              { maxItems: 8, maxLen: 80 }
            );

            await profileRef.set(
              {
                topic,
                level: levelProfile.id,
                levelLabel: levelProfile.label,
                focusTags,
                insightSummary: truncate(insightCache.insight.summary || "", 1200),
                lastInsightModel: "cache",
                lastInsightAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          } catch (profileWriteError) {
            log.warn("Explore profile update failed after cache hit", {
              uid, topic, level: levelProfile.id, error: profileWriteError.message,
            });
          }

          log.info("Explore topic insight served from cache", {
            uid, topic, level: levelProfile.id, cacheKey: insightCache.cacheKey,
          });

          return ok({
            topic,
            level: levelProfile.id,
            levelLabel: levelProfile.label,
            modelUsed: "cache",
            ...insightCache.insight,
            fromCache: true,
          });
        }
      } catch (cacheErr) {
        log.warn("Insight cache lookup failed; falling through to AI", {
          uid, topic, level: levelProfile.id, error: cacheErr.message,
        });
      }
    }
    // ── End cache lookup ──────────────────────────────────────────────

    const examContext = examType ? buildExamPlaybookPrompt(examType) : "";
    const prompt = exploreTopicInsightUserPrompt({
      topic,
      levelLabel: levelProfile.label,
      levelDescription: levelProfile.description || "",
      examContext: examContext || "",
      questionContext,
    });

    try {
      const geminiT0 = Date.now();
      const geminiResult = await withTimeout(
        geminiGenerate(EXPLORE_TOPIC_INSIGHT_SYSTEM, prompt, {
          maxTokens: 6_000,
          retries: 1,
          temperature: 0.15,
          rateLimitMaxRetries: 1,
          rateLimitRetryDelayMs: 2500,
        }).catch((error) => ({ success: false, error: error.message })),
        GEMINI_TIMEOUT_MS,
        "Gemini topic insight"
      );
      const geminiDurationMs = Date.now() - geminiT0;

      let payload = geminiResult.success && geminiResult.data ?
        normaliseInsightPayload(geminiResult.data, topic) :
        null;
      let modelUsed = "gemini";

      if (!payload) {
        const claudeT0 = Date.now();
        const claudeResult = await withTimeout(
          claudeGenerate(EXPLORE_TOPIC_INSIGHT_SYSTEM, prompt, {
            maxTokens: 7_000,
            retries: 1,
            usePrefill: false,
          }).catch((error) => ({ success: false, error: error.message })),
          CLAUDE_TIMEOUT_MS,
          "Claude topic insight fallback"
        );
        const claudeDurationMs = Date.now() - claudeT0;

        payload = claudeResult.success && claudeResult.data ?
          normaliseInsightPayload(claudeResult.data, topic) :
          null;
        modelUsed = "claude-fallback";

        log.info("Explore topic insight generated with fallback", {
          uid,
          topic,
          level: levelProfile.id,
          geminiSuccess: geminiResult.success,
          geminiDurationMs,
          claudeSuccess: claudeResult.success,
          claudeDurationMs,
        });
      } else {
        log.info("Explore topic insight generated", {
          uid,
          topic,
          level: levelProfile.id,
          modelUsed,
          geminiDurationMs,
        });
      }

      if (!payload) {
        return fail(Errors.AI_FAILED, "Could not generate a topic briefing right now.");
      }

      try {
        const profileDocId = buildExploreProfileDocId(topic, levelProfile.id);
        const profileRef = db.doc(`users/${uid}/exploreProfiles/${profileDocId}`);
        const focusTags = normaliseStringList(
          []
            .concat(payload.corePoints || [])
            .concat(payload.clinicalFramework?.diagnosticApproach || [])
            .concat(payload.clinicalFramework?.managementApproach || []),
          { maxItems: 8, maxLen: 80 }
        );

        await profileRef.set(
          {
            topic,
            level: levelProfile.id,
            levelLabel: levelProfile.label,
            focusTags,
            insightSummary: truncate(payload.summary || "", 1200),
            lastInsightModel: modelUsed,
            lastInsightAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (profileWriteError) {
        log.warn("Explore profile update failed after topic insight", {
          uid,
          topic,
          level: levelProfile.id,
          error: profileWriteError.message,
        });
      }

      // Non-blocking: populate global cache for future users.
      if (!hasQuestionContext) {
        writeInsight(topic, levelProfile.id, examType, payload, { modelUsed })
          .catch((err) => log.warn("Insight cache write failed", { topic, error: err.message }));
      }

      return ok({
        topic,
        level: levelProfile.id,
        levelLabel: levelProfile.label,
        modelUsed,
        ...payload,
      });
    } catch (error) {
      return safeError(error, "explore topic insight generation");
    }
  });

module.exports.__private = {
  normaliseCitationSource,
  buildSearchUrl,
  normaliseCitations,
  normaliseGuidelineUpdates,
  normaliseInsightPayload,
  normaliseTeachingSections,
  normaliseChartData,
  normaliseAlgorithmSteps,
  normaliseChartDataPoints,
};
