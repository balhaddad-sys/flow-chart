const {
  MAX_RECENT_STEMS,
  buildExploreProfileDocId,
  extractRecentStems,
  computeExploreProfilePatch,
  buildLearnedContext,
} = require("../explore/exploreLearningProfile");

describe("explore/exploreLearningProfile", () => {
  it("builds a stable doc id from topic and level", () => {
    const id = buildExploreProfileDocId("Acute Coronary Syndrome!!", "postgraduate");
    expect(id).toBe("POSTGRADUATE__acute-coronary-syndrome");
  });

  it("extractRecentStems deduplicates and clamps length", () => {
    const stems = extractRecentStems(
      {
        recentStems: [
          "First stem",
          "First   stem",
          "Second stem",
        ],
      },
      10
    );

    expect(stems).toEqual(["First stem", "Second stem"]);
  });

  it("computes profile patch with EMA and merged stems", () => {
    const patch = computeExploreProfilePatch(
      {
        runs: 2,
        qualityScoreEma: 0.7,
        inBandRatioEma: 0.75,
        hardCoverageEma: 0.6,
        recentStems: ["Old stem"],
        focusTags: ["Cardiology"],
      },
      {
        topic: "Acute Coronary Syndrome",
        level: "POSTGRADUATE",
        modelUsed: "gemini-fast",
        questions: [
          { stem: "New stem A", topicTags: ["cardiology", "acs"] },
          { stem: "New stem B", topicTags: ["acs"] },
        ],
        evaluation: {
          qualityScore: 0.9,
          metrics: { inBandRatio: 0.95, hardCount: 4 },
          targets: { hardFloorCount: 5 },
        },
      }
    );

    expect(patch.runs).toBe(3);
    expect(patch.qualityScoreEma).toBeGreaterThan(0.7);
    expect(patch.inBandRatioEma).toBeGreaterThan(0.75);
    expect(patch.recentStems[0]).toBe("New stem A");
    expect(patch.recentStems).toContain("Old stem");
    expect(patch.recentStems.length).toBeLessThanOrEqual(MAX_RECENT_STEMS);
    expect(Array.isArray(patch.focusTags)).toBe(true);
    expect(patch.focusTags.length).toBeGreaterThan(0);
  });

  it("buildLearnedContext returns guidance for weak prior trends", () => {
    const context = buildLearnedContext(
      {
        runs: 6,
        focusTags: ["Acute Coronary Syndrome", "ECG interpretation"],
        qualityScoreEma: 0.6,
        inBandRatioEma: 0.7,
        hardCoverageEma: 0.5,
      },
      { minDifficulty: 4 }
    );

    expect(context).toContain("Prior high-yield focus tags");
    expect(context).toContain("drifted");
    expect(context).toContain("Increase depth");
  });
});

