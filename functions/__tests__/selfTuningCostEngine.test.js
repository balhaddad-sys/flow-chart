const {
  buildQuestionGenPlan,
  updateQuestionGenStats,
} = require("../ai/selfTuningCostEngine");

describe("ai/selfTuningCostEngine", () => {
  describe("buildQuestionGenPlan", () => {
    it("skips AI when existing questions already satisfy request", () => {
      const plan = buildQuestionGenPlan({
        requestedCount: 10,
        existingCount: 12,
      });

      expect(plan.skipAI).toBe(true);
      expect(plan.aiRequestCount).toBe(0);
      expect(plan.estimatedSavingsPercent).toBe(100);
    });

    it("reduces request size when historical yield is strong", () => {
      const plan = buildQuestionGenPlan({
        requestedCount: 20,
        existingCount: 0,
        sectionStats: {
          runs: 8,
          validRateEma: 0.9,
          duplicateRateEma: 0.05,
          latencyMsEma: 8000,
        },
      });

      expect(plan.skipAI).toBe(false);
      expect(plan.aiRequestCount).toBeGreaterThanOrEqual(20);
      expect(plan.aiRequestCount).toBeLessThanOrEqual(30);
      expect(plan.retries).toBe(1);
    });

    it("switches to aggressive cost mode when latency trend is high", () => {
      const plan = buildQuestionGenPlan({
        requestedCount: 15,
        existingCount: 3,
        sectionStats: {
          runs: 12,
          validRateEma: 0.55,
          duplicateRateEma: 0.2,
          latencyMsEma: 32000,
        },
      });

      expect(plan.retries).toBe(0);
      expect(plan.rateLimitMaxRetries).toBe(0);
      expect(plan.rateLimitRetryDelayMs).toBe(5000);
    });
  });

  describe("updateQuestionGenStats", () => {
    it("updates EMA values and run count", () => {
      const stats = updateQuestionGenStats(
        {
          runs: 2,
          validRateEma: 0.6,
          duplicateRateEma: 0.1,
          latencyMsEma: 9000,
          tokenBudgetEma: 2000,
        },
        {
          aiRequestCount: 12,
          validProduced: 9,
          duplicateSkipped: 1,
          latencyMs: 7000,
          tokenBudget: 1800,
        }
      );

      expect(stats.runs).toBe(3);
      expect(stats.validRateEma).toBeGreaterThan(0.6);
      expect(stats.duplicateRateEma).toBeLessThanOrEqual(0.1);
      expect(stats.latencyMsEma).toBeLessThan(9000);
      expect(stats.tokenBudgetEma).toBeLessThanOrEqual(2000);
      expect(typeof stats.updatedAtISO).toBe("string");
    });
  });
});

