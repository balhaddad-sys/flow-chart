/**
 * @module cache/knowledgeCache
 * @description Core CRUD for the global `_knowledgeCache` Firestore collection.
 *
 * The knowledge cache stores AI-generated Explore questions and topic insights
 * in a shared collection so that identical topic+level requests are served from
 * cache instead of calling the AI again.
 *
 * All writes are non-blocking from the caller's perspective — failures are
 * logged but never propagated to the end user.
 */

const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const log = require("../lib/logger");
const { normalizeTopicKey, buildCacheKey } = require("./normalizeTopicKey");
const { CACHE_MAX_QUESTIONS_PER_TOPIC, CACHE_COLLECTION } = require("../lib/constants");

// Firestore paths must alternate collection/document/collection.
// We use a sentinel document `_root` to anchor the subcollections.
const ROOT_DOC = `${CACHE_COLLECTION}/_root`;
const questionsCol = () => db.collection(`${ROOT_DOC}/questions`);
const insightsCol = () => db.collection(`${ROOT_DOC}/insights`);
const gapsCol = () => db.collection(`${ROOT_DOC}/gaps`);

// ── Stem deduplication (mirrors exploreEngine.js:74-76) ─────────────────

function normaliseStemKey(stem) {
  return String(stem || "").replace(/\s+/g, " ").trim().toLowerCase();
}

// ── Question Cache ──────────────────────────────────────────────────────

/**
 * Look up cached questions for a topic+level.
 *
 * @param {string} topic  - Raw topic string.
 * @param {string} level  - Assessment level (e.g. "MD3").
 * @param {object} [opts]
 * @param {number} [opts.minCount=3] - Minimum cached questions to consider a hit.
 * @returns {Promise<{hit: boolean, questions: Array, cacheKey: string}>}
 */
async function lookupQuestions(topic, level, { minCount = 3 } = {}) {
  const cacheKey = buildCacheKey(topic, level);
  try {
    const snap = await questionsCol().doc(cacheKey).get();
    if (snap.exists) {
      const data = snap.data();
      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (questions.length >= minCount) {
        // Non-blocking hit counter increment
        snap.ref
          .update({
            hits: admin.firestore.FieldValue.increment(1),
            lastHitAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch((err) => log.warn("Cache hit counter update failed", { cacheKey, error: err.message }));

        return { hit: true, questions, cacheKey };
      }
    }
  } catch (err) {
    log.warn("Cache question lookup failed", { cacheKey, error: err.message });
  }

  // Cache miss — track the gap asynchronously.
  trackGap(topic, level, "questions").catch(() => {});
  return { hit: false, questions: [], cacheKey };
}

/**
 * Write (or merge) questions into the global cache.
 *
 * Deduplicates by stem similarity and caps at CACHE_MAX_QUESTIONS_PER_TOPIC.
 * Keeps highest-quality questions when the pool overflows.
 *
 * @param {string} topic
 * @param {string} level
 * @param {Array} newQuestions
 * @param {object} metadata - { modelUsed, qualityScore }
 */
async function writeQuestions(topic, level, newQuestions, metadata = {}) {
  if (!Array.isArray(newQuestions) || newQuestions.length === 0) return;

  const cacheKey = buildCacheKey(topic, level);
  const docRef = questionsCol().doc(cacheKey);
  const topicNormalized = normalizeTopicKey(topic);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    const snap = await docRef.get();
    const existing = snap.exists ? snap.data() : null;
    const existingQuestions = Array.isArray(existing?.questions) ? existing.questions : [];

    // Merge and deduplicate by stem
    const seenStems = new Set();
    const merged = [];

    // New questions take priority (fresher content)
    for (const q of newQuestions) {
      const key = normaliseStemKey(q?.stem);
      if (!key || seenStems.has(key)) continue;
      seenStems.add(key);
      merged.push({
        ...q,
        generatedAt: q.generatedAt || new Date().toISOString(),
        modelUsed: metadata.modelUsed || "unknown",
      });
    }

    // Then existing questions that aren't duplicates
    for (const q of existingQuestions) {
      const key = normaliseStemKey(q?.stem);
      if (!key || seenStems.has(key)) continue;
      seenStems.add(key);
      merged.push(q);
    }

    // Cap at max and keep highest quality (sort by difficulty spread + citation count)
    const capped = merged.slice(0, CACHE_MAX_QUESTIONS_PER_TOPIC);

    // Track topic aliases
    const aliases = Array.isArray(existing?.topicAliases) ? [...existing.topicAliases] : [];
    if (existing?.topicOriginal && topic !== existing.topicOriginal && !aliases.includes(topic)) {
      aliases.push(topic);
      if (aliases.length > 20) aliases.shift();
    }

    const payload = {
      topicNormalized,
      topicOriginal: existing?.topicOriginal || topic,
      topicAliases: aliases,
      level,
      questions: capped,
      questionCount: capped.length,
      lastGeneratedAt: now,
      updatedAt: now,
    };

    if (!existing) {
      payload.createdAt = now;
      payload.hits = 0;
    }

    await docRef.set(payload, { merge: true });

    // Mark gap as filled
    markGapFilled(topic, level, "questions").catch(() => {});

    log.info("Knowledge cache: questions written", {
      cacheKey,
      newCount: newQuestions.length,
      totalCount: capped.length,
      modelUsed: metadata.modelUsed,
    });
  } catch (err) {
    log.warn("Knowledge cache: question write failed", { cacheKey, error: err.message });
  }
}

// ── Insight Cache ───────────────────────────────────────────────────────

/**
 * Look up a cached topic insight.
 *
 * @param {string} topic
 * @param {string} level
 * @param {string|null} [examType]
 * @returns {Promise<{hit: boolean, insight: object|null, cacheKey: string}>}
 */
async function lookupInsight(topic, level, examType) {
  const cacheKey = buildCacheKey(topic, level, examType || null);
  try {
    const snap = await insightsCol().doc(cacheKey).get();
    if (snap.exists) {
      const data = snap.data();
      if (data.insight) {
        snap.ref
          .update({
            hits: admin.firestore.FieldValue.increment(1),
            lastHitAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch((err) => log.warn("Insight cache hit counter failed", { cacheKey, error: err.message }));

        return { hit: true, insight: data.insight, cacheKey };
      }
    }
  } catch (err) {
    log.warn("Cache insight lookup failed", { cacheKey, error: err.message });
  }

  trackGap(topic, level, "insights").catch(() => {});
  return { hit: false, insight: null, cacheKey };
}

/**
 * Write a topic insight to the global cache.
 *
 * @param {string} topic
 * @param {string} level
 * @param {string|null} examType
 * @param {object} insight - Full normalised insight payload.
 * @param {object} metadata - { modelUsed }
 */
async function writeInsight(topic, level, examType, insight, metadata = {}) {
  if (!insight) return;

  const cacheKey = buildCacheKey(topic, level, examType || null);
  const docRef = insightsCol().doc(cacheKey);
  const topicNormalized = normalizeTopicKey(topic);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    const snap = await docRef.get();
    const existing = snap.exists ? snap.data() : null;

    const aliases = Array.isArray(existing?.topicAliases) ? [...existing.topicAliases] : [];
    if (existing?.topicOriginal && topic !== existing.topicOriginal && !aliases.includes(topic)) {
      aliases.push(topic);
      if (aliases.length > 20) aliases.shift();
    }

    const payload = {
      topicNormalized,
      topicOriginal: existing?.topicOriginal || topic,
      topicAliases: aliases,
      level,
      examType: examType || null,
      insight,
      modelUsed: metadata.modelUsed || "unknown",
      updatedAt: now,
    };

    if (!existing) {
      payload.createdAt = now;
      payload.hits = 0;
    }

    await docRef.set(payload, { merge: true });

    markGapFilled(topic, level, "insights").catch(() => {});

    log.info("Knowledge cache: insight written", {
      cacheKey,
      modelUsed: metadata.modelUsed,
    });
  } catch (err) {
    log.warn("Knowledge cache: insight write failed", { cacheKey, error: err.message });
  }
}

// ── Gap Tracking ────────────────────────────────────────────────────────

/**
 * Record a cache miss so the system knows which topics to pre-warm.
 * Non-critical — never throws.
 */
async function trackGap(topic, level, contentType) {
  const topicKey = normalizeTopicKey(topic);
  const gapId = `${contentType}__${level}__${topicKey}`;
  const gapRef = gapsCol().doc(gapId);

  try {
    const snap = await gapRef.get();
    if (snap.exists) {
      await gapRef.update({
        topicOriginal: topic,
        requestCount: admin.firestore.FieldValue.increment(1),
        lastRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await gapRef.set({
        topicNormalized: topicKey,
        topicOriginal: topic,
        level,
        contentType,
        requestCount: 1,
        firstRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        filled: false,
        filledAt: null,
      });
    }
  } catch (err) {
    log.warn("Gap tracking failed", { gapId, error: err.message });
  }
}

/**
 * Mark a gap as filled after a successful cache write.
 */
async function markGapFilled(topic, level, contentType) {
  const topicKey = normalizeTopicKey(topic);
  const gapId = `${contentType}__${level}__${topicKey}`;
  try {
    await gapsCol().doc(gapId).update({
      filled: true,
      filledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch {
    // Gap document may not exist if this is the first request — that's fine.
  }
}

module.exports = {
  lookupQuestions,
  writeQuestions,
  lookupInsight,
  writeInsight,
  trackGap,
};
