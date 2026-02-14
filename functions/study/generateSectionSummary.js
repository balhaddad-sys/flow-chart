/**
 * @module study/generateSectionSummary
 * @description Callable function that generates a concise study summary
 * for a section's text using Gemini.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { ok, fail, Errors, safeError } = require("../lib/errors");
const { generateSummary } = require("../ai/geminiClient");
const log = require("../lib/logger");

const MAX_INPUT_CHARS = 12_000;
const MODEL_INPUT_CHARS = 8_000;
const MAX_LIST_ITEMS = 8;

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

function clampStringList(input, maxLen = 240) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS)
    .map((v) => v.slice(0, maxLen));
}

exports.generateSectionSummary = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "512MB",
    secrets: [geminiApiKey],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "title", maxLen: 240 },
      { field: "sectionText", maxLen: MAX_INPUT_CHARS },
    ]);

    await checkRateLimit(
      uid,
      "generateSectionSummary",
      RATE_LIMITS.generateSectionSummary
    );

    try {
      const title = data.title.trim();
      const sectionText = data.sectionText.trim().slice(0, MODEL_INPUT_CHARS);

      const result = await generateSummary(sectionText, title);
      if (!result.success || !result.data) {
        return fail(
          Errors.AI_FAILED,
          result.error || "Failed to generate section summary."
        );
      }

      const summary = String(result.data.summary || "").trim().slice(0, 2000);
      const keyPoints = clampStringList(result.data.keyPoints, 400);
      const mnemonics = clampStringList(result.data.mnemonics, 300);

      if (!summary && keyPoints.length === 0 && mnemonics.length === 0) {
        return fail(Errors.AI_FAILED, "Model returned an empty summary.");
      }

      log.info("Section summary generated", {
        uid,
        title,
        keyPointCount: keyPoints.length,
        mnemonicCount: mnemonics.length,
        model: result.model,
      });

      return ok({ summary, keyPoints, mnemonics });
    } catch (error) {
      return safeError(error, "summary generation");
    }
  });

