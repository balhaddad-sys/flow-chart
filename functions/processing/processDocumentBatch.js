/**
 * @module processing/processDocumentBatch
 * @description Callable function that extracts structured data from document
 * page images using Claude's vision capability.
 *
 * Accepts an array of base64-encoded page images, analyses them in parallel
 * with controlled concurrency, validates each result, and returns a unified
 * payload of extracted records together with per-page diagnostics.
 *
 * Input:  `{ images: string[], concurrency?: number }`
 * Output: `{ success, data: { results, pages, failures, meta } }`
 */

const functions = require("firebase-functions");
const pLimit = require("p-limit");
const { callClaudeVision, MAX_TOKENS, MODELS } = require("../ai/aiClient");
const { DOCUMENT_EXTRACT_SYSTEM, documentExtractUserPrompt } = require("../ai/prompts");
const {
  MAX_BATCH_PAGES,
  MAX_BASE64_LENGTH,
  DEFAULT_VISION_CONCURRENCY,
  MAX_VISION_CONCURRENCY,
} = require("../lib/constants");

// Define the secret so the function can access it (used by callClaudeVision)
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");
const { clampInt } = require("../lib/utils");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip a data-URL prefix (e.g. `data:image/jpeg;base64,...`) if present.
 * @param {string} input
 * @returns {string} Raw base64 data.
 */
function stripDataUrl(input) {
  const idx = input.indexOf("base64,");
  return idx !== -1 ? input.slice(idx + "base64,".length).trim() : input.trim();
}

/**
 * Validate the shape of a single vision-extracted page result.
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
      return { valid: false, error: `Record ${i} missing required 'test' or 'value' string fields` };
    }
  }
  return { valid: true };
}

/**
 * Analyse a single page image with Claude vision.
 * @param {string} base64Image
 * @param {number} pageIndex - Zero-based.
 * @returns {Promise<{ success: boolean, page: number, data?: object, error?: string, ms?: number }>}
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
    return { success: false, page: pageIndex, error: result.error, ms: result.ms };
  }

  const validation = validatePageResult(result.data);
  if (!validation.valid) {
    return { success: false, page: pageIndex, error: `Validation failed: ${validation.error}`, ms: result.ms };
  }

  return { success: true, page: pageIndex, data: result.data, ms: result.ms };
}

// ── Callable ─────────────────────────────────────────────────────────────────

exports.processDocumentBatch = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "1GB",
    secrets: [anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const start = Date.now();

    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = context.auth.uid;
    const { images, concurrency } = data;

    // ── Validate input ────────────────────────────────────────────────────
    if (!Array.isArray(images) || images.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "images must be a non-empty array of base64 strings");
    }
    if (images.length > MAX_BATCH_PAGES) {
      throw new functions.https.HttpsError("invalid-argument", `Too many pages. Maximum is ${MAX_BATCH_PAGES}.`);
    }

    const effectiveConcurrency = clampInt(
      concurrency || DEFAULT_VISION_CONCURRENCY,
      1,
      MAX_VISION_CONCURRENCY
    );

    // ── Clean & validate each image ───────────────────────────────────────
    const cleanedImages = [];
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] !== "string" || images[i].length < 20) {
        throw new functions.https.HttpsError("invalid-argument", `Page ${i} is not a valid base64 string.`);
      }
      const cleaned = stripDataUrl(images[i]);
      if (cleaned.length > MAX_BASE64_LENGTH) {
        throw new functions.https.HttpsError("invalid-argument", `Page ${i} exceeds size limit. Compress further (max ~${MAX_BASE64_LENGTH} base64 chars).`);
      }
      cleanedImages.push(cleaned);
    }

    // ── Parallel analysis ─────────────────────────────────────────────────
    console.log("Starting batch analysis", { pages: cleanedImages.length, concurrency: effectiveConcurrency, uid });

    const limit = pLimit(effectiveConcurrency);
    const settled = await Promise.all(
      cleanedImages.map((img, i) => limit(() => analyzeSinglePage(img, i)))
    );

    // ── Aggregate results ─────────────────────────────────────────────────
    const successes = settled.filter((r) => r.success);
    const failures = settled.filter((r) => !r.success).map((r) => ({ page: r.page, error: r.error, ms: r.ms }));
    const pagesSorted = successes.sort((a, b) => a.page - b.page).map((p) => p.data);
    const records = pagesSorted.flatMap((p) => p.records);
    const totalMs = Date.now() - start;

    console.log("Batch complete", {
      totalMs,
      pages: cleanedImages.length,
      successPages: successes.length,
      failedPages: failures.length,
      recordCount: records.length,
    });

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
