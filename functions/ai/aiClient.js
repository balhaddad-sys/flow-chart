const Anthropic = require("@anthropic-ai/sdk");

// EXACT MODEL STRINGS — do not modify without updating all downstream callers
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
};

const client = new Anthropic(); // Uses ANTHROPIC_API_KEY env variable

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

      // Strip markdown code fences if present
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      // Parse and return
      const parsed = JSON.parse(cleaned);
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
  generateBlueprint,
  generateQuestions,
  getTutorResponse,
  generateFixPlan,
};
