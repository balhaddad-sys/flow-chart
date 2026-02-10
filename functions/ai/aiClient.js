/**
 * @module ai/aiClient
 * @description Thin wrapper around the Anthropic Claude API.
 *
 * Provides:
 *  - `callClaude`       — Text-based JSON generation with retry + extraction.
 *  - `callClaudeVision` — Image-based extraction with prompt caching.
 *  - Convenience wrappers per prompt type (`generateBlueprint`, etc.).
 *  - `extractJsonFromText` — Robust JSON extraction from raw model output.
 */

const Anthropic = require("@anthropic-ai/sdk");

// Model identifiers — update here to roll out a new model globally.
const MODELS = {
  LIGHT: "claude-haiku-4-5-20251001", // Blueprints, question generation, task planning
  HEAVY: "claude-opus-4-6", // Tutoring, fix plans, complex reasoning
};

// Max tokens per prompt type
const MAX_TOKENS = {
  blueprint: 2048,
  questions: 4096,
  tutoring: 1024,
  fixPlan: 2048,
  documentExtract: 1200,
};

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY environment variable is not set. AI features will fail.");
}

const client = new Anthropic(); // Uses ANTHROPIC_API_KEY env variable

/**
 * Robust JSON extraction: handles code fences, leading/trailing text,
 * and other common Claude output quirks.
 * @param {string} text - Raw model output
 * @returns {string} Extracted JSON string
 */
function extractJsonFromText(text) {
  // Try direct parse first (fast path)
  try {
    JSON.parse(text);
    return text;
  } catch {
    // continue to cleanup
  }

  // Strip markdown code fences and trim
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Try direct parse after cleaning
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // continue to brace-matching
  }

  // Find first JSON object or array boundaries
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

  if (lastClose <= firstOpen) {
    throw new Error("Malformed JSON boundaries in model output.");
  }

  return cleaned.slice(firstOpen, lastClose + 1);
}

/**
 * Call Claude API with automatic retry and JSON validation.
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {string} tier - "LIGHT" or "HEAVY"
 * @param {number} maxTokens - Max tokens for response
 * @param {number} retries - Retry count (default 2)
 * @returns {object} Parsed JSON response
 */
async function callClaude(
  systemPrompt,
  userPrompt,
  tier,
  maxTokens,
  retries = 2
) {
  const model = MODELS[tier];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      });

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      // Robust JSON extraction
      const jsonStr = extractJsonFromText(text);
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed, model, tokensUsed: response.usage };
    } catch (error) {
      console.error(`AI call attempt ${attempt + 1}/${retries + 1} failed:`, {
        model,
        tier,
        error: error.message,
      });

      if (attempt === retries) {
        return {
          success: false,
          error: error.message,
          model,
          rawResponse: error.rawResponse || null,
        };
      }

      // Wait before retry (exponential backoff)
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Call Claude with a vision (image) message. Supports prompt caching
 * on the system prompt for faster TTFT on repeated calls.
 * @param {object} opts
 * @param {string} opts.systemPrompt - Stable system prompt (cached)
 * @param {string} opts.base64Image - Base64-encoded image data (no data URL prefix)
 * @param {string} opts.mediaType - MIME type (e.g. "image/jpeg")
 * @param {string} opts.userText - Per-image user instruction
 * @param {string} opts.tier - "LIGHT" or "HEAVY"
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
  const model = MODELS[tier];
  const t0 = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        // Prompt caching: mark system prompt as ephemeral for cache reuse
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: userText,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const jsonStr = extractJsonFromText(text);
      const parsed = JSON.parse(jsonStr);

      return {
        success: true,
        data: parsed,
        model,
        tokensUsed: response.usage,
        ms: Date.now() - t0,
      };
    } catch (error) {
      console.error(
        `Vision call attempt ${attempt + 1}/${retries + 1} failed:`,
        { model, tier, error: error.message }
      );

      if (attempt === retries) {
        return {
          success: false,
          error: error.message,
          model,
          ms: Date.now() - t0,
        };
      }

      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

// Convenience wrappers
async function generateBlueprint(systemPrompt, userPrompt) {
  return callClaude(systemPrompt, userPrompt, "LIGHT", MAX_TOKENS.blueprint);
}

async function generateQuestions(systemPrompt, userPrompt) {
  return callClaude(systemPrompt, userPrompt, "LIGHT", MAX_TOKENS.questions);
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
