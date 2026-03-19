/**
 * @module ai/deepseekClient
 * @description DeepSeek V3 client for cost-optimized question generation.
 *
 * DeepSeek V3 is ~12x cheaper than Claude Haiku for structured JSON output
 * ($0.28/$0.42 per 1M tokens vs $1.00/$5.00). Uses the OpenAI-compatible
 * API format — no additional SDK dependency required.
 *
 * Used for: on-demand question generation (non-critical path)
 * NOT used for: tutoring, chat, or real-time interactions (latency-sensitive)
 */

const { extractJson } = require("./geminiClient");

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MODEL_ID = "deepseek-chat";
const RETRY_DELAYS = [500, 1500, 4000];
const RATE_LIMIT_RETRY_DELAY = 10000;
const RATE_LIMIT_MAX_RETRIES = 2;

/**
 * Call DeepSeek V3 for structured JSON generation.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} [opts]
 * @param {number} [opts.maxTokens=4096]
 * @param {number} [opts.retries=2]
 * @param {number} [opts.temperature=0.2]
 * @returns {{ success: boolean, data?: object, text?: string, error?: string, model: string, tokensUsed?: object }}
 */
async function callDeepSeek(systemPrompt, userPrompt, opts = {}) {
  const {
    maxTokens = 4096,
    retries = 2,
    temperature = 0.2,
    jsonMode = false,
  } = opts;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { success: false, error: "DEEPSEEK_API_KEY not configured", model: MODEL_ID };
  }

  const body = {
    model: MODEL_ID,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  let attempt = 0;
  let rateLimitRetries = 0;

  for (;;) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000); // 45s — leaves room for Claude fallback within 120s function timeout

      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 429) {
        if (rateLimitRetries < RATE_LIMIT_MAX_RETRIES) {
          rateLimitRetries++;
          console.warn(`DeepSeek rate limited, retry ${rateLimitRetries}/${RATE_LIMIT_MAX_RETRIES}`);
          await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY));
          continue;
        }
        return { success: false, error: "DeepSeek rate limit exceeded", model: MODEL_ID };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const usage = data.usage;
      const tokensUsed = usage
        ? { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0, cached: usage.prompt_cache_hit_tokens || 0 }
        : null;

      if (!content) {
        throw new Error("DeepSeek returned empty response");
      }

      if (jsonMode) {
        const parsed = extractJson(content);
        return { success: true, data: parsed, model: MODEL_ID, tokensUsed };
      }

      return { success: true, text: content, model: MODEL_ID, tokensUsed };
    } catch (error) {
      console.error(`DeepSeek attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

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
 * Generate questions using DeepSeek V3.
 * Drop-in compatible with aiClient.generateQuestions return format.
 */
async function generateQuestions(systemPrompt, userPrompt, opts = {}) {
  return callDeepSeek(systemPrompt, userPrompt, {
    maxTokens: opts.maxTokens ?? 8192,
    retries: opts.retries ?? 1,
    temperature: opts.temperature ?? 0.3,
    jsonMode: true,
  });
}

module.exports = {
  MODEL_ID,
  callDeepSeek,
  generateQuestions,
};
