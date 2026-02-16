const {
  FAST_READY_COUNT,
  computeFastStartCounts,
  computeMaxBackfillAttempts,
} = require("../questions/generationPlanning");

describe("questions/generationPipeline", () => {
  describe("computeFastStartCounts", () => {
    it("prepares an immediate fast-start batch of up to 3 questions", () => {
      const out = computeFastStartCounts(10, 0);
      expect(out.targetCount).toBe(10);
      expect(out.missingCount).toBe(10);
      expect(out.immediateCount).toBe(FAST_READY_COUNT);
    });

    it("uses smaller immediate batch when missing count is below fast-start size", () => {
      const out = computeFastStartCounts(10, 8);
      expect(out.missingCount).toBe(2);
      expect(out.immediateCount).toBe(2);
    });

    it("returns zero immediate work when enough questions already exist", () => {
      const out = computeFastStartCounts(10, 12);
      expect(out.missingCount).toBe(0);
      expect(out.immediateCount).toBe(0);
    });
  });

  describe("computeMaxBackfillAttempts", () => {
    it("scales with target count", () => {
      expect(computeMaxBackfillAttempts(10)).toBe(30);
    });

    it("enforces lower and upper bounds", () => {
      expect(computeMaxBackfillAttempts(1)).toBe(18);
      expect(computeMaxBackfillAttempts(30)).toBe(60);
    });
  });
});
