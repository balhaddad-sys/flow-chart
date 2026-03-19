/**
 * @module questions/generateQuestions
 * @description Callable function that generates exam-style SBA questions.
 *
 * ARCHITECTURE (v2 — hybrid inline + async):
 *
 *  1. For small requests (≤15 questions): generate INLINE in this function call.
 *     The user gets questions back in the response instantly (~8-15 seconds).
 *
 *  2. For large requests (>15 questions): queue a background job for batch
 *     generation. Return immediately with a job ID for polling.
 *
 *  3. If inline generation fails (rate limit, AI error): fall back to async.
 *
 * This eliminates the 30-second blind-polling loop for 90%+ of use cases.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const {
  computeFastStartCounts,
  computeMaxBackfillAttempts,
  fetchExistingQuestionState,
  resolveSourceFileName,
  resolveExamType,
  queueQuestionBackfillJob,
  generateAndPersistBatch,
} = require("./generationPipeline");

const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

/**
 * Questions at or below this threshold are generated synchronously in-request.
 * Above this, we queue a background job. 15 questions ≈ one Claude call (~15s).
 */
const INLINE_THRESHOLD = 15;

exports.generateQuestions = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: [anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const t0 = Date.now();
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "courseId", maxLen: 128 },
      { field: "sectionId", maxLen: 128 },
    ]);
    const count = requireInt(data, "count", 1, 100, 10);

    await checkRateLimit(uid, "generateQuestions", RATE_LIMITS.generateQuestions);

    const { courseId, sectionId } = data;
    const sectionRef = db.doc(`users/${uid}/sections/${sectionId}`);

    try {
      // ── 1. Fetch & validate section ───────────────────────────────────
      const sectionDoc = await sectionRef.get();
      if (!sectionDoc.exists) return fail(Errors.NOT_FOUND, "Section not found.");

      const section = sectionDoc.data();
      if (section.courseId !== courseId) {
        return fail(Errors.INVALID_ARGUMENT, "Section does not belong to this course.");
      }
      if (!section.blueprint) return fail(Errors.NOT_ANALYZED);

      const bp = section.blueprint;
      const bpContentCount =
        (bp.learningObjectives?.length || 0) +
        (bp.keyConcepts?.length || 0) +
        (bp.highYieldPoints?.length || 0) +
        (bp.commonTraps?.length || 0) +
        (bp.termsToDefine?.length || 0);
      if (bpContentCount === 0) {
        // Non-instructional sections (title pages, TOC, etc.) have empty blueprints —
        // return gracefully instead of treating as an error.
        if (section.isNonInstructional) {
          return ok({ questionCount: 0, generatedNow: 0, fromCache: true, backgroundQueued: false, skipped: true, reason: "Non-instructional section" });
        }
        return fail(Errors.NOT_ANALYZED, "Section blueprint has no content. Please retry the section analysis first.");
      }

      // ── 2. Count existing questions ───────────────────────────────────
      const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId });
      const effectiveCount = existingState.distinctCount || existingState.count;
      const { targetCount, missingCount } = computeFastStartCounts(count, effectiveCount);

      // ── 3. Already have enough → instant return ───────────────────────
      if (effectiveCount >= targetCount) {
        await sectionRef.set(
          {
            questionsStatus: "COMPLETED",
            questionsCount: existingState.count,
            questionsErrorMessage: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
        return ok({
          questionCount: existingState.count,
          effectiveQuestionCount: effectiveCount,
          generatedNow: 0,
          fromCache: true,
          backgroundQueued: false,
          targetCount,
          durationMs: Date.now() - t0,
        });
      }

      // ── 4. Already generating → check if stale ────────────────────────
      if (section.questionsStatus === "GENERATING") {
        // Detect stale GENERATING state: if stuck for > 3 minutes, reset and regenerate.
        const STALE_THRESHOLD_MS = 3 * 60 * 1000;
        const lastUpdate = section.lastErrorAt?.toMillis?.()
          || section.updatedAt?.toMillis?.()
          || 0;
        const isStale = lastUpdate > 0 && (Date.now() - lastUpdate > STALE_THRESHOLD_MS);

        if (!isStale) {
          log.info("Generation already in progress", {
            uid, courseId, sectionId,
            questionsCount: section.questionsCount || 0,
          });
          return ok({
            questionCount: section.questionsCount || 0,
            inProgress: true,
            backgroundQueued: true,
            message: "Question generation is already in progress.",
          });
        }

        // Stale — reset and fall through to re-generate
        log.warn("Resetting stale GENERATING status", {
          uid, courseId, sectionId,
          staleSinceMs: lastUpdate > 0 ? Date.now() - lastUpdate : "unknown",
        });
        await sectionRef.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: "Previous generation stalled. Retrying.",
          activeQuestionJobId: admin.firestore.FieldValue.delete(),
        });
        // Fall through to inline/async generation below
      }

      // ── 5. INLINE GENERATION (≤15 missing) ───────────────────────────
      //    Generate right here, right now. Return questions in the response.
      if (missingCount <= INLINE_THRESHOLD) {
        return await _generateInline({
          uid, courseId, sectionId, section, sectionRef,
          existingState, effectiveCount, targetCount, missingCount, t0,
        });
      }

      // ── 6. ASYNC: queue background job (>15 missing) ──────────────────
      return await _queueAsync({
        uid, courseId, sectionId, sectionRef,
        existingState, effectiveCount, targetCount, missingCount, t0,
      });
    } catch (error) {
      // CRITICAL: Roll back questionsStatus to avoid a stuck GENERATING state.
      await _rollbackSectionStatus({ uid, courseId, sectionId, sectionRef, error, t0 });
      return safeError(error, "question generation");
    }
  });

// ── Inline generation path ──────────────────────────────────────────────────

async function _generateInline({
  uid, courseId, sectionId, section, sectionRef,
  existingState, effectiveCount, targetCount, missingCount, t0,
}) {
  // Mark as generating (optimistic — rolled back on failure)
  await sectionRef.update({
    questionsStatus: "GENERATING",
    questionsErrorMessage: admin.firestore.FieldValue.delete(),
  });

  let batch;
  try {
    const [sourceFileName, examType] = await Promise.all([
      resolveSourceFileName(uid, section.fileId),
      resolveExamType(uid, courseId),
    ]);

    batch = await generateAndPersistBatch({
      uid,
      courseId,
      sectionId,
      section,
      sourceFileName,
      existingCount: effectiveCount,
      existingStems: existingState.stems,
      existingStemList: existingState.stemList,
      targetCount,
      examType,
    });
  } catch (inlineError) {
    // Inline failed — fall back to async instead of failing entirely
    log.warn("Inline generation failed, falling back to async", {
      uid, courseId, sectionId,
      error: inlineError.message,
    });

    return await _queueAsync({
      uid, courseId, sectionId, sectionRef,
      existingState, effectiveCount, targetCount, missingCount: targetCount - effectiveCount, t0,
    });
  }

  // If AI returned nothing, try async fallback
  if (!batch.success && effectiveCount === 0) {
    log.warn("Inline generation produced no questions, falling back to async", {
      uid, courseId, sectionId,
      error: batch.error,
    });

    return await _queueAsync({
      uid, courseId, sectionId, sectionRef,
      existingState, effectiveCount, targetCount, missingCount: targetCount - effectiveCount, t0,
    });
  }

  const generatedNow = batch.generatedNow || 0;
  const finalCount = existingState.count + generatedNow;
  const finalDistinct = effectiveCount + generatedNow;
  const stillNeeded = targetCount - finalDistinct;
  const status = finalDistinct > 0 ? "COMPLETED" : "FAILED";

  await sectionRef.update({
    questionsStatus: status,
    questionsCount: finalCount,
    lastQuestionsDurationMs: Date.now() - t0,
    activeQuestionJobId: admin.firestore.FieldValue.delete(),
    questionsErrorMessage: status === "COMPLETED"
      ? admin.firestore.FieldValue.delete()
      : "AI generation produced no valid questions.",
  });

  // If inline yielded some but not enough, queue backfill for the remainder
  if (generatedNow > 0 && stillNeeded > 0) {
    log.info("Inline generation underfilled, queueing backfill", {
      uid, courseId, sectionId,
      generated: generatedNow,
      target: targetCount,
      stillNeeded,
    });
    // Fire-and-forget: queue a backfill job for the remaining questions
    try {
      await db.collection(`users/${uid}/jobs`).add({
        type: "questionBackfill",
        courseId,
        sectionId,
        requestedCount: stillNeeded,
        status: "PENDING",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (backfillErr) {
      log.warn("Failed to queue backfill job", { error: backfillErr.message });
    }
  }

  log.info("Questions generated inline", {
    uid, courseId, sectionId,
    requested: targetCount,
    generated: generatedNow,
    duplicatesSkipped: batch.duplicateStemSkipped || 0,
    totalNow: finalCount,
    backfillQueued: stillNeeded > 0,
    durationMs: Date.now() - t0,
  });

  return ok({
    questionCount: finalCount,
    effectiveQuestionCount: finalDistinct,
    generatedNow,
    skippedCount: batch.skippedCount || 0,
    backgroundQueued: false,
    fromCache: false,
    targetCount,
    durationMs: Date.now() - t0,
    // Return the generated question docs so frontend can show them immediately
    questions: batch.docs || [],
  });
}

// ── Async queue path ────────────────────────────────────────────────────────

async function _queueAsync({
  uid, courseId, sectionId, sectionRef,
  existingState, effectiveCount, targetCount, missingCount, t0,
}) {
  await sectionRef.update({
    questionsStatus: "GENERATING",
    questionsErrorMessage: admin.firestore.FieldValue.delete(),
  });

  const backfillJobId = await queueQuestionBackfillJob({
    uid,
    courseId,
    sectionId,
    targetCount,
    attempt: 1,
    maxAttempts: computeMaxBackfillAttempts(targetCount),
  });

  await sectionRef.update({ activeQuestionJobId: backfillJobId });

  log.info("Questions queued (async)", {
    uid, courseId, sectionId,
    requested: targetCount,
    existingCount: existingState.count,
    effectiveCount,
    missingCount,
    jobId: backfillJobId,
    durationMs: Date.now() - t0,
  });

  return ok({
    questionCount: existingState.count,
    effectiveQuestionCount: effectiveCount,
    generatedNow: 0,
    skippedCount: 0,
    backgroundQueued: true,
    remainingCount: missingCount,
    targetCount,
    readyNow: existingState.count,
    jobId: backfillJobId,
    durationMs: Date.now() - t0,
  });
}

// ── Error rollback ──────────────────────────────────────────────────────────

async function _rollbackSectionStatus({ uid, courseId, sectionId, sectionRef, error, t0 }) {
  try {
    let existingCount = 0;
    try {
      const state = await fetchExistingQuestionState({ uid, courseId, sectionId, limit: 40 });
      existingCount = state.count;
    } catch (err) { console.warn("fetchExistingQuestionState lookup failed:", err.message); }

    await sectionRef.update({
      questionsStatus: existingCount > 0 ? "COMPLETED" : "FAILED",
      questionsCount: existingCount,
      questionsErrorMessage: error.message || "Unexpected error during question generation",
      lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
      lastQuestionsDurationMs: Date.now() - t0,
      activeQuestionJobId: admin.firestore.FieldValue.delete(),
    });
  } catch (updateError) {
    log.error("Failed to update section status after error", {
      uid, sectionId,
      updateError: updateError.message,
    });
  }
}
