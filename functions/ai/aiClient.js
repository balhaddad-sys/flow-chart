/**
 * @module ai/aiClient
 * @description Production-grade Claude API wrapper for MedQ's AI pipeline.
 *
 * Key Features:
 *  - **Prefill Injection:** Forces pure JSON output by starting the assistant
 *    response with "{", eliminating markdown code blocks and conversational text
 *    that would break JSON.parse(). This is the industry-standard technique for
 *    structured output from LLMs.
 *
 *  - **Prompt Caching:** System prompts are marked as ephemeral, allowing Claude
 *    to reuse cached context across repeated calls (90% cost reduction on cache hits).
 *
 *  - **Retry Logic:** Exponential backoff on failures (network, rate limits, transient errors).
 *
 *  - **Robust Extraction:** Multi-layer JSON parsing that handles edge cases in model output.
 *
 * Functions:
 *  - `callClaude`       — Text-based JSON generation with retry + prefill injection.
 *  - `callClaudeVision` — Image-based extraction with prompt caching.
 *  - Convenience wrappers per prompt type (`generateBlueprint`, `generateQuestions`, etc.).
 *  - `extractJsonFromText` — Robust JSON extraction from raw model output.
 */

const Anthropic = require("@anthropic-ai/sdk");

// Model identifiers — update here to roll out a new model globally.
const MODELS = {
  LIGHT: "claude-haiku-4-5-20251001", // Blueprints, question generation, task planning
  HEAVY: "claude-opus-4-6", // Tutoring, fix plans, complex reasoning
};

// Max tokens per prompt type — tuned for speed vs completeness
const MAX_TOKENS = {
  blueprint: 2500, // Increased from 2048 to prevent truncation on content-rich sections
  questions: 3000,
  tutoring: 1024,
  fixPlan: 2048,
  documentExtract: 1200,
};

// Retry delays in ms for non-rate-limit errors
const RETRY_DELAYS = [500, 1500, 4000];

// Rate limit retry: wait 60s (full rate window reset) before retrying
const RATE_LIMIT_RETRY_DELAY = 60000;
const RATE_LIMIT_MAX_RETRIES = 4; // Up to 5 attempts total for rate limits

// Lazy-initialized Anthropic client.
// Firebase secrets are only available at function invocation time, NOT at module load.
// So we create the client on first use rather than at import time.
let _client = null;

function getClient() {
  if (_client) return _client;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
      "Ensure the function declares `secrets: [anthropicApiKey]` in runWith()."
    );
  }

  _client = new Anthropic();
  return _client;
}

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
 * Uses prompt caching on system prompts for faster repeated calls.
 *
 * CRITICAL: Uses prefill injection to force JSON-only output. This ensures Claude
 * always starts with "{" or "[", preventing markdown code blocks and conversational
 * preambles that would break JSON.parse().
 *
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {string} tier - "LIGHT" or "HEAVY"
 * @param {number} maxTokens - Max tokens for response
 * @param {number} retries - Retry count (default 2)
 * @param {boolean} usePrefill - Enable prefill injection (default true)
 * @returns {object} Parsed JSON response
 */
async function callClaude(
  systemPrompt,
  userPrompt,
  tier,
  maxTokens,
  retries = 2,
  usePrefill = true
) {
  const model = MODELS[tier];
  let rateLimitRetries = 0;
  let attempt = 0;

  while (true) {
    try {
      // Build messages array with optional prefill injection
      const messages = [{ role: "user", content: userPrompt }];

      if (usePrefill) {
        messages.push({ role: "assistant", content: "{" });
      }

      const response = await getClient().messages.create({
        model: model,
        max_tokens: maxTokens,
        messages: messages,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
      });

      let text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      if (usePrefill) {
        text = "{" + text;
      }

      const jsonStr = extractJsonFromText(text);
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed, model, tokensUsed: response.usage };
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message?.includes("rate_limit");

      if (isRateLimit && rateLimitRetries < RATE_LIMIT_MAX_RETRIES) {
        rateLimitRetries++;
        console.warn(`Rate limited, waiting 60s before retry ${rateLimitRetries}/${RATE_LIMIT_MAX_RETRIES}`, { model, tier });
        await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
        continue; // Don't increment attempt counter for rate limits
      }

      console.error(`AI call attempt ${attempt + 1}/${retries + 1} failed:`, {
        model,
        tier,
        error: error.message,
        isRateLimit,
      });

      if (attempt >= retries) {
        return {
          success: false,
          error: error.message,
          model,
          rawResponse: error.rawResponse || null,
        };
      }

      attempt++;
      const delay = RETRY_DELAYS[attempt - 1] || 4000;
      await new Promise((r) => setTimeout(r, delay));
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
  let rateLimitRetries = 0;
  let attempt = 0;

  while (true) {
    try {
      const response = await getClient().messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
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
      const isRateLimit = error.status === 429 || error.message?.includes("rate_limit");

      if (isRateLimit && rateLimitRetries < RATE_LIMIT_MAX_RETRIES) {
        rateLimitRetries++;
        console.warn(`Vision rate limited, waiting 60s before retry ${rateLimitRetries}/${RATE_LIMIT_MAX_RETRIES}`, { model, tier });
        await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
        continue;
      }

      console.error(
        `Vision call attempt ${attempt + 1}/${retries + 1} failed:`,
        { model, tier, error: error.message, isRateLimit }
      );

      if (attempt >= retries) {
        return {
          success: false,
          error: error.message,
          model,
          ms: Date.now() - t0,
        };
      }

      attempt++;
      const delay = RETRY_DELAYS[attempt - 1] || 4000;
      await new Promise((r) => setTimeout(r, delay));
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
