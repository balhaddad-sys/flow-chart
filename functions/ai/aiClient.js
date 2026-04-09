/**
 * @module ai/aiClient
 * @description AI client for MedQ's pipeline — powered by FREE Hugging Face models.
 *
 * Delegates to hfClient.js for text generation (Mistral/Mixtral via HF Inference API)
 * and geminiClient.js for vision tasks. Maintains the same exported interface so all
 * callers (generateBlueprint, generateQuestions, getTutorResponse, etc.) work unchanged.
 *
 * Key Features:
 *  - **Zero cost:** Uses HF free-tier serverless inference (~5K-10K req/day)
 *  - **Retry Logic:** Handled by hfClient (exponential backoff + cold-start detection)
 *  - **Robust Extraction:** Multi-layer JSON parsing for LLM output edge cases
 *
 * Functions:
 *  - `callClaude`       — Text-based JSON generation (now routed to HF).
 *  - `callClaudeVision` — Image-based extraction (routed to Gemini).
 *  - Convenience wrappers per prompt type (`generateBlueprint`, `generateQuestions`, etc.).
 *  - `extractJsonFromText` — Robust JSON extraction from raw model output.
 */

const { callHF, MODELS: HF_MODELS } = require("./hfClient");
const { jsonrepair } = require("jsonrepair");

// Model identifiers — mapped to HF models via hfClient
const MODELS = {
  LIGHT: HF_MODELS.LIGHT, // Blueprints, question generation, task planning
  HEAVY: HF_MODELS.HEAVY, // Tutoring, fix plans, chat (quality-optimized)
};

// Max tokens per prompt type — aligned with selfTuningCostEngine ceiling (5200)
const MAX_TOKENS = {
  blueprint: 1800,
  questions: 5200,
  tutoring: 1024,
  fixPlan: 2048,
  documentExtract: 800,
};

/**
 * Robust JSON extraction: handles code fences, leading/trailing text,
 * truncated output, and other common Claude output quirks.
 *
 * Layers (in order):
 *  1. Direct JSON.parse
 *  2. Strip code fences + parse
 *  3. Brace-match extraction + parse
 *  4. jsonrepair (handles truncated/malformed JSON from token limits)
 *
 * @param {string} text - Raw model output
 * @returns {string} Extracted JSON string (guaranteed parseable)
 */
function extractJsonFromText(text) {
  // Layer 1: Try direct parse (fast path)
  try {
    JSON.parse(text);
    return text;
  } catch {
    // continue
  }

  // Strip markdown code fences and trim
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Layer 2: Try direct parse after cleaning
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // continue
  }

  // Layer 3: Brace-match extraction
  const firstOpen = Math.min(
    cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
    cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("[")
  );
  if (firstOpen === Infinity) {
    throw new Error("No JSON object or array found in model output.");
  }

  const isArray = cleaned[firstOpen] === "[";
  const closeChar = isArray ? "]" : "}";
  const lastClose = cleaned.lastIndexOf(closeChar);

  if (lastClose > firstOpen) {
    const extracted = cleaned.slice(firstOpen, lastClose + 1);
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // continue to repair
    }

    // Layer 4: jsonrepair — handles truncated JSON from token limits
    try {
      const repaired = jsonrepair(extracted);
      JSON.parse(repaired); // validate
      return repaired;
    } catch {
      // continue
    }
  }

  // Layer 4b: jsonrepair on full cleaned text (last resort)
  try {
    const repaired = jsonrepair(cleaned);
    JSON.parse(repaired);
    return repaired;
  } catch {
    throw new Error("Failed to parse or repair JSON from model output.");
  }
}

/**
 * Call AI model for text-based JSON generation via Hugging Face.
 * Drop-in replacement for the previous Claude callClaude function.
 *
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {string} tier - "LIGHT" or "HEAVY"
 * @param {number} maxTokens - Max tokens for response
 * @param {number} retries - Retry count (default 2)
 * @param {boolean} _usePrefill - Ignored (kept for API compat)
 * @returns {object} { success, data, model, tokensUsed } or { success: false, error }
 */
async function callClaude(
  systemPrompt,
  userPrompt,
  tier,
  maxTokens,
  retries = 2,
  _usePrefill = true
) {
  // Append JSON instruction to system prompt to encourage structured output
  const jsonSystemPrompt = systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, no explanatory text.";

  return callHF(jsonSystemPrompt, userPrompt, tier, {
    maxTokens,
    retries,
    temperature: 0.3,
    jsonMode: true,
  });
}

/**
 * Vision (image) extraction — delegated to Gemini (free tier).
 * HF free tier doesn't reliably support vision models, so we use Gemini Flash.
 * Keeps the same interface as the original callClaudeVision.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt - System prompt
 * @param {string} opts.base64Image - Base64-encoded image data
 * @param {string} opts.mediaType - MIME type (e.g. "image/jpeg")
 * @param {string} opts.userText - Per-image user instruction
 * @param {string} opts.tier - Ignored (always uses Gemini)
 * @param {number} opts.maxTokens - Max tokens for response
 * @param {number} [opts.retries=2] - Retry count
 * @returns {object} { success, data, model, tokensUsed, ms } or { success: false, error }
 */
async function callClaudeVision({
  systemPrompt,
  base64Image,
  mediaType = "image/jpeg",
  userText,
  tier,
  maxTokens,
  retries = 2,
}) {
  // Delegate to Gemini vision (free tier)
  const { callGeminiVision } = require("./geminiClient");
  return callGeminiVision({
    systemPrompt,
    base64Image,
    mediaType,
    userText,
    maxTokens,
    retries,
  });
}

// Convenience wrappers
async function generateBlueprint(systemPrompt, userPrompt) {
  return callClaude(systemPrompt, userPrompt, "LIGHT", MAX_TOKENS.blueprint);
}

async function generateQuestions(systemPrompt, userPrompt, opts = {}) {
  return callClaude(
    systemPrompt,
    userPrompt,
    "LIGHT",
    opts.maxTokens || MAX_TOKENS.questions,
    opts.retries == null ? 2 : opts.retries,
    opts.usePrefill == null ? true : opts.usePrefill
  );
}

async function getTutorResponse(systemPrompt, userPrompt) {
  return callClaude(systemPrompt, userPrompt, "HEAVY", MAX_TOKENS.tutoring);
}

async function generateFixPlan(systemPrompt, userPrompt) {
  return callClaude(systemPrompt, userPrompt, "HEAVY", MAX_TOKENS.fixPlan);
}

module.exports = {
  MODELS,
  MAX_TOKENS,
  callClaude,
  callClaudeVision,
  extractJsonFromText,
  generateBlueprint,
  generateQuestions,
  getTutorResponse,
  generateFixPlan,
};
