/**
 * @module ai/selfTuningCostEngine
 * @description Self-tuning cost controller for question generation.
 *
 * The controller continuously updates section-level generation stats and uses
 * them to choose a lower-cost AI request size/token budget on future runs.
 */

const { clampInt } = require("../lib/utils");

const DEFAULT_VALID_RATE = 0.82;
const DEFAULT_DUP_RATE = 0.05;
const MIN_PREDICTED_YIELD = 0.25;
const MAX_PREDICTED_YIELD = 0.95;
const EMA_ALPHA = 0.35;

function clampFloat(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function buildQuestionGenPlan({
  requestedCount,
  existingCount = 0,
  sectionStats = {},
}) {
  const safeRequested = clampInt(requestedCount || 10, 1, 30);
  const safeExisting = clampInt(existingCount || 0, 0, 1000);
  const missingCount = Math.max(0, safeRequested - safeExisting);

  if (missingCount <= 0) {
    return {
      skipAI: true,
      missingCount: 0,
      aiRequestCount: 0,
      tokenBudget: 0,
      retries: 0,
      rateLimitMaxRetries: 0,
      rateLimitRetryDelayMs: 0,
      predictedYield: 1,
      estimatedSavingsPercent: 100,
    };
  }

  const runs = clampInt(sectionStats.runs || 0, 0, 10_000);
  const validRate = clampFloat(sectionStats.validRateEma ?? DEFAULT_VALID_RATE, 0, 1);
  const duplicateRate = clampFloat(sectionStats.duplicateRateEma ?? DEFAULT_DUP_RATE, 0, 0.7);
  const latencyMs = clampInt(sectionStats.latencyMsEma || 0, 0, 120_000);

  const predictedYield = clampFloat(
    validRate * (1 - duplicateRate),
    MIN_PREDICTED_YIELD,
    MAX_PREDICTED_YIELD
  );

  // Early runs are uncertain, so use slightly larger safety margin.
  const uncertaintyBuffer = runs < 3 ? 0.10 : runs < 8 ? 0.06 : 0.04;
  const expectedNeed = Math.ceil(missingCount / predictedYield);
  const aiRequestCount = clampInt(
    Math.ceil(expectedNeed * (1 + uncertaintyBuffer)),
    missingCount,
    Math.max(missingCount + 12, safeRequested * 2)
  );

  const tokenBudget = clampInt(800 + aiRequestCount * 180, 1000, 3200);
  const retries = latencyMs > 25_000 ? 0 : 1;
  const rateLimitMaxRetries = latencyMs > 25_000 ? 0 : 1;
  const rateLimitRetryDelayMs = latencyMs > 25_000 ? 5000 : 8000;

  const naiveCount = safeRequested;
  const estimatedSavingsPercent = clampInt(
    Math.round(((naiveCount - aiRequestCount) / Math.max(naiveCount, 1)) * 100),
    0,
    90
  );

  return {
    skipAI: false,
    missingCount,
    aiRequestCount,
    tokenBudget,
    retries,
    rateLimitMaxRetries,
    rateLimitRetryDelayMs,
    predictedYield: Number(predictedYield.toFixed(3)),
    estimatedSavingsPercent,
  };
}

function updateQuestionGenStats(previous = {}, runMetrics = {}) {
  const prevRuns = clampInt(previous.runs || 0, 0, 10_000);
  const prevValidRate = clampFloat(previous.validRateEma ?? DEFAULT_VALID_RATE, 0, 1);
  const prevDupRate = clampFloat(previous.duplicateRateEma ?? DEFAULT_DUP_RATE, 0, 0.7);
  const prevLatency = clampInt(previous.latencyMsEma || 0, 0, 120_000);
  const prevTokenBudget = clampInt(previous.tokenBudgetEma || 0, 0, 10_000);

  const requested = Math.max(1, clampInt(runMetrics.aiRequestCount || 1, 1, 1000));
  const validProduced = clampInt(runMetrics.validProduced || 0, 0, requested);
  const duplicateSkipped = clampInt(runMetrics.duplicateSkipped || 0, 0, requested);
  const latencyMs = clampInt(runMetrics.latencyMs || 0, 0, 120_000);
  const tokenBudget = clampInt(runMetrics.tokenBudget || 0, 0, 10_000);

  const runValidRate = validProduced / requested;
  const runDupRate = duplicateSkipped / requested;

  const runs = prevRuns + 1;
  const validRateEma = Number(((prevValidRate * (1 - EMA_ALPHA)) + runValidRate * EMA_ALPHA).toFixed(4));
  const duplicateRateEma = Number(((prevDupRate * (1 - EMA_ALPHA)) + runDupRate * EMA_ALPHA).toFixed(4));
  const latencyMsEma = clampInt(
    Math.round(prevLatency * (1 - EMA_ALPHA) + latencyMs * EMA_ALPHA),
    0,
    120_000
  );
  const tokenBudgetEma = clampInt(
    Math.round(prevTokenBudget * (1 - EMA_ALPHA) + tokenBudget * EMA_ALPHA),
    0,
    10_000
  );

  return {
    runs,
    validRateEma,
    duplicateRateEma,
    latencyMsEma,
    tokenBudgetEma,
    updatedAtISO: new Date().toISOString(),
  };
}

module.exports = {
  buildQuestionGenPlan,
  updateQuestionGenStats,
};

