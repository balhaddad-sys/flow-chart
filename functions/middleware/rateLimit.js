/**
 * @module middleware/rateLimit
 * @description Per-user, per-operation sliding-window rate limiter.
 *
 * Primary state lives in Firestore (`_rateLimits/{uid}:{operation}`) so that
 * limits are enforced consistently across Cloud Functions instances.  A
 * short-lived in-memory cache (10 s TTL) avoids a Firestore read on every
 * call.  If the Firestore transaction fails for any reason other than an
 * already-raised rate-limit error, the limiter falls back to in-memory
 * tracking to avoid blocking legitimate requests.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();

// ── In-memory cache ──────────────────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL_MS = 10_000;

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Enforce the rate limit for a given user + operation pair.
 *
 * @param {string} uid - Firebase Auth UID.
 * @param {string} operation - Logical operation name (must match a key in {@link RATE_LIMITS}).
 * @param {{ maxCalls: number, windowMs: number }} limits
 * @returns {Promise<void>} Resolves when the call is allowed.
 * @throws {functions.https.HttpsError} `resource-exhausted` when the limit is exceeded.
 */
async function checkRateLimit(uid, operation, { maxCalls, windowMs }) {
  const key = `${uid}:${operation}`;
  const now = Date.now();

  // Fast-path: reject from cache if already at the limit.
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS && cached.count >= maxCalls) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Rate limit exceeded for ${operation}. Please wait before trying again.`
    );
  }

  const rateLimitRef = db.doc(`_rateLimits/${key}`);

  try {
    const result = await db.runTransaction(async (txn) => {
      const doc = await txn.get(rateLimitRef);
      const data = doc.exists ? doc.data() : { calls: [], createdAt: now };

      const windowStart = now - windowMs;
      const recentCalls = (data.calls || []).filter((t) => t > windowStart);

      if (recentCalls.length >= maxCalls) {
        return { allowed: false, count: recentCalls.length };
      }

      recentCalls.push(now);
      txn.set(rateLimitRef, {
        calls: recentCalls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { allowed: true, count: recentCalls.length };
    });

    cache.set(key, { count: result.count, timestamp: now });

    if (!result.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded for ${operation}. Please wait before trying again.`
      );
    }
  } catch (error) {
    if (error.code === "resource-exhausted") throw error;

    // Firestore failure — degrade to in-memory tracking.
    // This logic allows the current request to succeed to avoid blocking
    // legitimate users during transient backend errors. Subsequent calls are
    // then subject to the in-memory limit.
    console.warn(`Rate limit Firestore check failed for ${key}:`, error.message);
    const fallback = cache.get(key);
    if (fallback) {
      fallback.count++;
      fallback.timestamp = now;
    } else {
      cache.set(key, { count: 1, timestamp: now });
    }
  }
}

// ── Predefined limits ────────────────────────────────────────────────────────

/**
 * Rate-limit presets for every callable endpoint.
 * Format: `{ maxCalls, windowMs }`.
 */
const RATE_LIMITS = {
  generateQuestions:    { maxCalls: 10, windowMs:    60_000 },
  generateSchedule:    { maxCalls:  5, windowMs:    60_000 },
  regenSchedule:       { maxCalls:  5, windowMs:    60_000 },
  submitAttempt:       { maxCalls: 60, windowMs:    60_000 },
  getQuiz:             { maxCalls: 30, windowMs:    60_000 },
  catchUp:             { maxCalls:  5, windowMs:    60_000 },
  processDocumentBatch:{ maxCalls:  5, windowMs:   300_000 },
  deleteUserData:      { maxCalls:  1, windowMs: 3_600_000 },
  runFixPlan:          { maxCalls:  3, windowMs:    60_000 },
};

module.exports = { checkRateLimit, RATE_LIMITS };
