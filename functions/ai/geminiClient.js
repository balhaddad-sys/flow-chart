/**
 * @module ai/geminiClient
 * @description Gemini Flash client for fast vision/OCR and quick summaries.
 *
 * Gemini Flash is used alongside Claude for tasks where speed matters more
 * than depth: document vision/OCR and quick section summaries.
 *
 * Key Features:
 *  - Lazy-initialized client (API key only available at invocation time)
 *  - Retry logic with exponential backoff
 *  - Vision support for base64 images
 *  - JSON extraction with robust parsing
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { jsonrepair } = require("jsonrepair");

const MODEL_ID = "gemini-2.0-flash";

const MAX_TOKENS = {
  vision: 2048,
  summary: 1024,
};

const RETRY_DELAYS = [500, 1500, 4000];
const RATE_LIMIT_RETRY_DELAY = 60000;
const RATE_LIMIT_MAX_RETRIES = 3;

let _client = null;

function getClient() {
  if (_client) return _client;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Ensure the function declares the secret in runWith()."
    );
  }

  _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _client;
}

/**
 * Repair common JSON issues from LLM output:
 * - trailing commas before } or ]
 * - unescaped control characters inside strings
 * @param {string} text
 * @returns {string}
 */
function repairJson(text) {
  // Remove trailing commas before closing brackets
  let fixed = text.replace(/,\s*([\]}])/g, "$1");
  // Replace unescaped control chars (newlines/tabs) that appear between quotes
  fixed = fixed.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) =>
    match
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\r/g, "\\r")
      .replace(/(?<!\\)\t/g, "\\t")
  );
  return fixed;
}

/**
 * Parse JSON with layered repair strategies.
 * @param {string} text
 * @returns {object|null}
 */
function parseJsonSafely(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  if (looksLikeJson) {
    try {
      return JSON.parse(repairJson(trimmed));
    } catch {
      // continue
    }
  }

  if (looksLikeJson) {
    try {
      return JSON.parse(jsonrepair(trimmed));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extract JSON from Gemini output, handling code fences, trailing commas,
 * control characters, and extra text around JSON.
 * @param {string} text - Raw model output
 * @returns {object} Parsed JSON
 */
function extractJson(text) {
  // Step 1: Try raw parse + repair paths
  const parsedRaw = parseJsonSafely(text);
  if (parsedRaw != null) return parsedRaw;

  // Step 2: Strip code fences and whitespace
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsedCleaned = parseJsonSafely(cleaned);
  if (parsedCleaned != null) return parsedCleaned;

  // Step 4: Extract by brace matching
  const firstOpen = Math.min(
    cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
    cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("[")
  );
  if (firstOpen === Infinity) {
    throw new Error("No JSON found in Gemini output.");
  }

  const isArray = cleaned[firstOpen] === "[";
  const closeChar = isArray ? "]" : "}";
  const lastClose = cleaned.lastIndexOf(closeChar);

  if (lastClose <= firstOpen) {
    throw new Error("Malformed JSON in Gemini output.");
  }

  const extracted = cleaned.slice(firstOpen, lastClose + 1);

  const parsedExtracted = parseJsonSafely(extracted);
  if (parsedExtracted != null) return parsedExtracted;

  throw new Error("Failed to parse JSON from Gemini output.");
}

/**
 * Call Gemini Flash for text generation with retry.
 * @param {string} systemPrompt - System instruction
 * @param {string} userPrompt - User message
 * @param {object} [opts]
 * @param {number} [opts.maxTokens] - Max output tokens
 * @param {number} [opts.retries] - Retry count
 * @param {boolean} [opts.jsonMode] - Parse response as JSON
 * @returns {object} { success, data|text, model }
 */
async function callGemini(systemPrompt, userPrompt, opts = {}) {
  const {
    maxTokens = MAX_TOKENS.summary,
    retries = 2,
    jsonMode = false,
    temperature = 0.2,
    rateLimitMaxRetries = RATE_LIMIT_MAX_RETRIES,
    rateLimitRetryDelayMs = RATE_LIMIT_RETRY_DELAY,
  } = opts;
  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature,
  };
  // Enforce structured JSON output when jsonMode is enabled
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
    generationConfig,
  });

  let attempt = 0;
  let rateLimitRetries = 0;
  for (;;) {
    try {
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      const usage = result.response.usageMetadata;
      const tokensUsed = usage
        ? { input: usage.promptTokenCount || 0, output: usage.candidatesTokenCount || 0 }
        : null;

      if (jsonMode) {
        const data = extractJson(text);
        return { success: true, data, model: MODEL_ID, tokensUsed };
      }

      return { success: true, text, model: MODEL_ID, tokensUsed };
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit && rateLimitRetries < rateLimitMaxRetries) {
        rateLimitRetries++;
        console.warn(
          `Gemini rate limited, waiting ${Math.round(rateLimitRetryDelayMs / 1000)}s before retry ${rateLimitRetries}/${rateLimitMaxRetries}`
        );
        await new Promise((r) => setTimeout(r, rateLimitRetryDelayMs));
        continue;
      }

      console.error(`Gemini call attempt ${attempt + 1}/${retries + 1} failed:`, {
        error: error.message,
        isRateLimit,
      });

      if (attempt >= retries) {
        return { success: false, error: error.message, model: MODEL_ID };
      }

      attempt++;
      const delay = RETRY_DELAYS[attempt - 1] || 4000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Call Gemini Flash with a vision (image) message.
 * @param {object} opts
 * @param {string} opts.systemPrompt - System instruction
 * @param {string} opts.base64Image - Base64-encoded image
 * @param {string} opts.mediaType - MIME type
 * @param {string} opts.userText - User instruction
 * @param {number} [opts.maxTokens] - Max tokens
 * @param {number} [opts.retries] - Retry count
 * @returns {object} { success, data, model, ms }
 */
async function callGeminiVision({
  systemPrompt,
  base64Image,
  mediaType = "image/jpeg",
  userText,
  maxTokens = MAX_TOKENS.vision,
  retries = 2,
}) {
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0,
    },
  });

  const t0 = Date.now();
  let attempt = 0;
  let rateLimitRetries = 0;

  for (;;) {
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mediaType,
            data: base64Image,
          },
        },
        { text: userText },
      ]);

      const text = result.response.text();
      const data = extractJson(text);
      const usage = result.response.usageMetadata;
      const tokensUsed = usage
        ? { input: usage.promptTokenCount || 0, output: usage.candidatesTokenCount || 0 }
        : null;

      return {
        success: true,
        data,
        model: MODEL_ID,
        ms: Date.now() - t0,
        tokensUsed,
      };
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit && rateLimitRetries < RATE_LIMIT_MAX_RETRIES) {
        rateLimitRetries++;
        console.warn(`Gemini vision rate limited, waiting 60s before retry ${rateLimitRetries}/${RATE_LIMIT_MAX_RETRIES}`);
        await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
        continue;
      }

      console.error(`Gemini vision attempt ${attempt + 1}/${retries + 1} failed:`, {
        error: error.message,
        isRateLimit,
      });

      if (attempt >= retries) {
        return {
          success: false,
          error: error.message,
          model: MODEL_ID,
          ms: Date.now() - t0,
        };
      }

      attempt++;
      const delay = RETRY_DELAYS[attempt - 1] || 4000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Generate a quick summary of section text using Gemini Flash.
 * @param {string} sectionText - The text to summarize
 * @param {string} title - Section title for context
 * @returns {object} { success, data: { summary, keyPoints } }
 */
async function generateSummary(sectionText, title) {
  const systemPrompt = `You are MedQ Summarizer. Create concise, exam-focused summaries of medical study material.
Output STRICT JSON only. No markdown, no commentary.`;

  const userPrompt = `Section: "${title}"

Text:
"""
${sectionText}
"""

Return this exact JSON schema:
{
  "summary": "string — 2-3 sentence overview",
  "keyPoints": ["string — 4-6 bullet points of the most important facts"],
  "mnemonics": ["string — 0-2 memory aids if applicable"]
}`;

  return callGemini(systemPrompt, userPrompt, {
    maxTokens: MAX_TOKENS.summary,
    jsonMode: true,
  });
}

/**
 * Generate a blueprint from section text using Gemini Flash.
 * Drop-in replacement for aiClient.generateBlueprint.
 */
async function generateBlueprint(systemPrompt, userPrompt) {
  return callGemini(systemPrompt, userPrompt, {
    maxTokens: 2500,
    jsonMode: true,
  });
}

/**
 * Generate questions from a blueprint using Gemini Flash.
 * Drop-in replacement for aiClient.generateQuestions.
 */
async function generateQuestions(systemPrompt, userPrompt, opts = {}) {
  return callGemini(systemPrompt, userPrompt, {
    maxTokens: opts.maxTokens ?? 3200,
    retries: opts.retries ?? 1,
    rateLimitMaxRetries: opts.rateLimitMaxRetries ?? 1,
    rateLimitRetryDelayMs: opts.rateLimitRetryDelayMs ?? 8000,
    temperature: opts.temperature ?? 0.2,
    jsonMode: true,
  });
}

module.exports = {
  MODEL_ID,
  MAX_TOKENS,
  callGemini,
  callGeminiVision,
  generateSummary,
  generateBlueprint,
  generateQuestions,
  extractJson,
};
