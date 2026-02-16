const {
  buildExploreTargets,
  prioritiseQuestions,
  evaluateQuestionSet,
  mergeQuestionSets,
} = require("../explore/exploreEngine");

describe("explore/exploreEngine", () => {
  const md3 = {
    id: "MD3",
    label: "MD3",
    minDifficulty: 2,
    maxDifficulty: 4,
  };

  const postgraduate = {
    id: "POSTGRADUATE",
    label: "Postgraduate",
    minDifficulty: 4,
    maxDifficulty: 5,
  };

  it("buildExploreTargets increases hard/expert floors for postgraduate", () => {
    const targets = buildExploreTargets(postgraduate, 10);
    expect(targets.inBandRatio).toBeGreaterThanOrEqual(0.8);
    expect(targets.hardFloorCount).toBeGreaterThanOrEqual(5);
    expect(targets.expertFloorCount).toBeGreaterThanOrEqual(1);
  });

  it("prioritiseQuestions deduplicates by stem and respects requested count", () => {
    const questions = [
      { stem: "A", difficulty: 3, citations: [{}, {}] },
      { stem: "A", difficulty: 4, citations: [{}] },
      { stem: "B", difficulty: 4, citations: [{}, {}, {}] },
      { stem: "C", difficulty: 2, citations: [] },
    ];

    const selected = prioritiseQuestions(questions, md3, 2);
    expect(selected).toHaveLength(2);
    expect(new Set(selected.map((q) => q.stem)).size).toBe(2);
  });

  it("mergeQuestionSets keeps uniqueness across batches", () => {
    const merged = mergeQuestionSets(
      [
        [
          { stem: "A", difficulty: 4, citations: [] },
          { stem: "B", difficulty: 4, citations: [] },
        ],
        [
          { stem: "B", difficulty: 5, citations: [] },
          { stem: "C", difficulty: 5, citations: [] },
        ],
      ],
      postgraduate,
      3
    );

    expect(merged).toHaveLength(3);
    expect(new Set(merged.map((q) => q.stem)).size).toBe(3);
  });

  it("evaluateQuestionSet returns quality metadata", () => {
    const evaluation = evaluateQuestionSet(
      [
        { stem: "A", difficulty: 5 },
        { stem: "B", difficulty: 5 },
        { stem: "C", difficulty: 4 },
      ],
      postgraduate,
      3
    );

    expect(typeof evaluation.qualityScore).toBe("number");
    expect(evaluation.metrics.total).toBe(3);
    expect(typeof evaluation.qualityGatePassed).toBe("boolean");
  });
});
