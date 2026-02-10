const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * In-memory rate limiter backed by Firestore for persistence across instances.
 * Uses a sliding window counter pattern.
 *
 * Rate limits are per-user, per-function.
 */

// In-memory cache to avoid Firestore reads on every call
const cache = new Map();
const CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Check and enforce rate limit for a user + operation.
 * @param {string} uid - User ID
 * @param {string} operation - Operation name (e.g., "generateQuestions")
 * @param {object} limits - { maxCalls: number, windowMs: number }
 * @returns {Promise<void>} Resolves if allowed, throws HttpsError if rate limited
 */
async function checkRateLimit(uid, operation, { maxCalls, windowMs }) {
  const functions = require("firebase-functions");
  const key = `${uid}:${operation}`;
  const now = Date.now();

  // Check in-memory cache first
  const cached = cache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    if (cached.count >= maxCalls) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded for ${operation}. Please wait before trying again.`
      );
    }
  }

  // Check Firestore for persistent rate tracking
  const rateLimitRef = db.doc(`_rateLimits/${key}`);

  try {
    const result = await db.runTransaction(async (txn) => {
      const doc = await txn.get(rateLimitRef);
      const data = doc.exists ? doc.data() : { calls: [], createdAt: now };

      // Filter calls within the window
      const windowStart = now - windowMs;
      const recentCalls = (data.calls || []).filter((t) => t > windowStart);

      if (recentCalls.length >= maxCalls) {
        return { allowed: false, count: recentCalls.length };
      }

      // Add this call
      recentCalls.push(now);
      txn.set(rateLimitRef, {
        calls: recentCalls,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { allowed: true, count: recentCalls.length };
    });

    // Update cache
    cache.set(key, { count: result.count, timestamp: now });

    if (!result.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded for ${operation}. Please wait before trying again.`
      );
    }
  } catch (error) {
    // If it's already an HttpsError (rate limit), re-throw
    if (error.code === "resource-exhausted") throw error;

    // For Firestore errors, fall back to in-memory tracking only
    console.warn(`Rate limit Firestore check failed for ${key}:`, error.message);
    const fallback = cache.get(key);
    if (fallback) {
      fallback.count = (fallback.count || 0) + 1;
      fallback.timestamp = now;
    } else {
      cache.set(key, { count: 1, timestamp: now });
    }
  }
}

/**
 * Predefined rate limits for different operations.
 */
const RATE_LIMITS = {
  generateQuestions: { maxCalls: 10, windowMs: 60_000 },     // 10/min
  generateSchedule: { maxCalls: 5, windowMs: 60_000 },       // 5/min
  regenSchedule: { maxCalls: 5, windowMs: 60_000 },          // 5/min
  submitAttempt: { maxCalls: 60, windowMs: 60_000 },          // 60/min
  getQuiz: { maxCalls: 30, windowMs: 60_000 },               // 30/min
  catchUp: { maxCalls: 5, windowMs: 60_000 },                // 5/min
  processDocumentBatch: { maxCalls: 5, windowMs: 300_000 },   // 5/5min
  deleteUserData: { maxCalls: 1, windowMs: 3_600_000 },       // 1/hour
};

module.exports = { checkRateLimit, RATE_LIMITS };
