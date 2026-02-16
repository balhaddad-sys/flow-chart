const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");

describe("lib/difficulty", () => {
  it("returns counts that sum to requested total", () => {
    const counts = computeSectionQuestionDifficultyCounts(12, 3);
    expect(counts.easyCount + counts.mediumCount + counts.hardCount).toBe(12);
  });

  it("skews harder for high-difficulty sections", () => {
    const easy = computeSectionQuestionDifficultyCounts(10, 1);
    const hard = computeSectionQuestionDifficultyCounts(10, 5);
    expect(hard.hardCount).toBeGreaterThanOrEqual(easy.hardCount);
    expect(hard.easyCount).toBeLessThanOrEqual(easy.easyCount);
  });
});

