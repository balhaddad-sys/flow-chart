/**
 * @module ai/hfClient
 * @description Hugging Face Inference API client for FREE AI generation.
 *
 * Uses the OpenAI-compatible chat completions endpoint on HF's serverless
 * inference API. Free tier supports ~5K-10K requests/day with generous
 * rate limits.
 *
 * Models:
 *  - LIGHT: Mistral-7B-Instruct — fast, good for structured JSON output
 *  - HEAVY: Mixtral-8x7B-Instruct — higher quality for tutoring/chat
 *
 * Key Features:
 *  - OpenAI-compatible API (same format as DeepSeek client)
 *  - Retry logic with exponential backoff
 *  - Model warm-up detection and auto-retry (cold starts take 5-30s)
 *  - JSON extraction via shared geminiClient utility
 */

const { extractJson } = require("./geminiClient");

const HF_API_BASE = "https://api-inference.huggingface.co/models";

const MODELS = {
  LIGHT: "mistralai/Mistral-7B-Instruct-v0.3",
  HEAVY: "mistralai/Mixtral-8x7B-Instruct-v0.1",
};

const RETRY_DELAYS = [500, 2000, 5000];
const MODEL_LOADING_RETRY_DELAY = 15000; // 15s wait for cold model
const MODEL_LOADING_MAX_RETRIES = 3;     // Up to 3 waits for model warm-up
const REQUEST_TIMEOUT_MS = 60000;        // 60s timeout per request

/**
 * Call a Hugging Face model via the OpenAI-compatible chat completions endpoint.
 *
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {string} tier - "LIGHT" or "HEAVY"
 * @param {object} [opts]
 * @param {number} [opts.maxTokens=4096]
 * @param {number} [opts.retries=2]
 * @param {number} [opts.temperature=0.3]
 * @returns {{ success: boolean, data?: object, text?: string, error?: string, model: string, tokensUsed?: object }}
 */
async function callHF(systemPrompt, userPrompt, tier, opts = {}) {
  const {
    maxTokens = 4096,
    retries = 2,
    temperature = 0.3,
    jsonMode = true,
  } = opts;

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    return { success: false, error: "HF_API_KEY not configured", model: MODELS[tier] };
  }

  const model = MODELS[tier] || MODELS.LIGHT;
  const url = `${HF_API_BASE}/${model}/v1/chat/completions`;

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };

  let attempt = 0;
  let loadingRetries = 0;

  for (;;) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle model loading (cold start) — HF returns 503 while model warms up
      if (res.status === 503) {
        if (loadingRetries < MODEL_LOADING_MAX_RETRIES) {
          loadingRetries++;
          const estimatedTime = await res.json().then(r => r.estimated_time).catch(() => 15);
          const waitMs = Math.min((estimatedTime || 15) * 1000, 30000);
          console.warn(`HF model loading, waiting ${Math.round(waitMs / 1000)}s (retry ${loadingRetries}/${MODEL_LOADING_MAX_RETRIES})`, { model });
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return { success: false, error: "HF model failed to load after retries", model };
      }

      // Handle rate limits
      if (res.status === 429) {
        if (attempt < retries) {
          attempt++;
          const delay = RETRY_DELAYS[attempt - 1] || 5000;
          console.warn(`HF rate limited, waiting ${delay}ms (attempt ${attempt}/${retries + 1})`, { model });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { success: false, error: "HF rate limit exceeded", model };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`HF API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const usage = data.usage;
      const tokensUsed = usage
        ? { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 }
        : null;

      if (!content) {
        throw new Error("HF returned empty response");
      }

      if (jsonMode) {
        const parsed = extractJson(content);
        return { success: true, data: parsed, model, tokensUsed };
      }

      return { success: true, text: content, model, tokensUsed };
    } catch (error) {
      if (error.name === "AbortError") {
        error.message = `HF request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`;
      }

      console.error(`HF attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

      if (attempt >= retries) {
        return { success: false, error: error.message, model };
      }

      attempt++;
      const delay = RETRY_DELAYS[attempt - 1] || 5000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

module.exports = {
  MODELS,
  HF_API_BASE,
  MODEL_LOADING_RETRY_DELAY,
  callHF,
};
