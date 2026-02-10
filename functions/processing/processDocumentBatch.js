const functions = require("firebase-functions");
const pLimit = require("p-limit");
const { callClaudeVision, MAX_TOKENS, MODELS } = require("../ai/aiClient");
const {
  DOCUMENT_EXTRACT_SYSTEM,
  documentExtractUserPrompt,
} = require("../ai/prompts");

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIG
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Controlled parallelism (real-world sweet spot: 6–10)
const DEFAULT_CONCURRENCY = 8;

// Safety limits
const MAX_PAGES = 25;
const MAX_BASE64_LENGTH = 450_000; // ~450KB per image in base64

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Remove data URL prefix if provided (e.g. "data:image/jpeg;base64,...").
 * @param {string} base64OrDataUrl
 * @returns {string} Raw base64 string
 */
function stripDataUrl(base64OrDataUrl) {
  const idx = base64OrDataUrl.indexOf("base64,");
  if (idx !== -1) return base64OrDataUrl.slice(idx + "base64,".length).trim();
  return base64OrDataUrl.trim();
}

/**
 * Validate a single page record against expected shape.
 * Lightweight check — no external schema lib needed.
 * @param {object} data
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePageResult(data) {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Response is not an object" };
  }
  if (typeof data.page !== "number") {
    return { valid: false, error: "Missing or invalid 'page' field" };
  }
  if (!Array.isArray(data.records)) {
    return { valid: false, error: "Missing or invalid 'records' array" };
  }
  for (let i = 0; i < data.records.length; i++) {
    const r = data.records[i];
    if (!r || typeof r.test !== "string" || typeof r.value !== "string") {
      return {
        valid: false,
        error: `Record ${i} missing required 'test' or 'value' string fields`,
      };
    }
  }
  return { valid: true };
}

/**
 * Analyze a single page image with Claude vision.
 * @param {string} base64Image - Raw base64 image data
 * @param {number} pageIndex - Zero-based page index
 * @returns {object} { success, page, data?, error?, ms }
 */
async function analyzeSinglePage(base64Image, pageIndex) {
  const result = await callClaudeVision({
    systemPrompt: DOCUMENT_EXTRACT_SYSTEM,
    base64Image,
    mediaType: "image/jpeg",
    userText: documentExtractUserPrompt({ pageIndex }),
    tier: "LIGHT",
    maxTokens: MAX_TOKENS.documentExtract,
    retries: 2,
  });

  if (!result.success) {
    return {
      success: false,
      page: pageIndex,
      error: result.error,
      ms: result.ms,
    };
  }

  // Validate shape
  const validation = validatePageResult(result.data);
  if (!validation.valid) {
    return {
      success: false,
      page: pageIndex,
      error: `Validation failed: ${validation.error}`,
      ms: result.ms,
    };
  }

  return {
    success: true,
    page: pageIndex,
    data: result.data,
    ms: result.ms,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CALLABLE FUNCTION
 *
 * Input:  { images: string[], concurrency?: number }
 * Output: { results, pages, failures, meta }
 * ─────────────────────────────────────────────────────────────────────────────
 */
exports.processDocumentBatch = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    const start = Date.now();

    // Auth required (medical data)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { images, concurrency } = data;

    // ── Validate input ──────────────────────────────────────────────────

    if (!Array.isArray(images) || images.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "images must be a non-empty array of base64 strings"
      );
    }

    if (images.length > MAX_PAGES) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Too many pages. Maximum is ${MAX_PAGES}.`
      );
    }

    const effectiveConcurrency = Math.min(
      Math.max(1, concurrency || DEFAULT_CONCURRENCY),
      12
    );

    // ── Clean & validate each image ─────────────────────────────────────

    const cleanedImages = [];
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] !== "string" || images[i].length < 20) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Page ${i} is not a valid base64 string.`
        );
      }

      const cleaned = stripDataUrl(images[i]);

      if (cleaned.length > MAX_BASE64_LENGTH) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Page ${i} exceeds size limit. Compress further (max ~${MAX_BASE64_LENGTH} base64 chars).`
        );
      }

      cleanedImages.push(cleaned);
    }

    // ── Run parallel analysis with controlled concurrency ───────────────

    console.log("Starting batch analysis", {
      pages: cleanedImages.length,
      concurrency: effectiveConcurrency,
      uid,
    });

    const limit = pLimit(effectiveConcurrency);

    const promises = cleanedImages.map((img, i) =>
      limit(() => analyzeSinglePage(img, i))
    );

    const settled = await Promise.all(promises);

    // ── Separate successes / failures ───────────────────────────────────

    const successes = settled.filter((r) => r.success);
    const failures = settled
      .filter((r) => !r.success)
      .map((r) => ({ page: r.page, error: r.error, ms: r.ms }));

    // Sort by page order and flatten records
    const pagesSorted = successes
      .sort((a, b) => a.page - b.page)
      .map((p) => p.data);

    const records = pagesSorted.flatMap((p) => p.records);

    const totalMs = Date.now() - start;

    console.log("Batch complete", {
      totalMs,
      pages: cleanedImages.length,
      successPages: successes.length,
      failedPages: failures.length,
      recordCount: records.length,
      pageTimings: settled.map((r) => ({
        page: r.page,
        ms: r.ms,
        ok: r.success,
      })),
    });

    // ── Return unified payload ──────────────────────────────────────────

    return {
      success: true,
      data: {
        results: records,
        pages: pagesSorted,
        failures,
        meta: {
          model: MODELS.LIGHT,
          totalMs,
          pagesTotal: cleanedImages.length,
          pagesSucceeded: successes.length,
          pagesFailed: failures.length,
        },
      },
    };
  });
