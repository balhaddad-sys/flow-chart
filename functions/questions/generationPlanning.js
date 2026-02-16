/**
 * @module questions/generationPlanning
 * @description Pure planning helpers for staged question generation.
 */

const { clampInt } = require("../lib/utils");

const FAST_READY_COUNT = 3;
const BACKFILL_STEP_COUNT = 30;
const MAX_NO_PROGRESS_STREAK = 4;

function computeFastStartCounts(requestedCount, existingCount) {
  const targetCount = clampInt(requestedCount || 10, 1, 30);
  const safeExisting = clampInt(existingCount || 0, 0, 1000);
  const missingCount = Math.max(0, targetCount - safeExisting);
  const immediateCount = Math.min(FAST_READY_COUNT, missingCount);

  return {
    targetCount,
    existingCount: safeExisting,
    missingCount,
    immediateCount,
  };
}

function computeMaxBackfillAttempts(targetCount) {
  const safeTarget = clampInt(targetCount || 10, 1, 30);
  return clampInt(safeTarget * 3, 18, 60);
}

module.exports = {
  FAST_READY_COUNT,
  BACKFILL_STEP_COUNT,
  MAX_NO_PROGRESS_STREAK,
  computeFastStartCounts,
  computeMaxBackfillAttempts,
};
