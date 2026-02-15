const {
  normalizeAssessmentLevel,
  getAssessmentLevel,
  selectAssessmentQuestions,
  computeWeaknessProfile,
  buildRecommendationPlan,
} = require("../assessment/engine");

describe("assessment/engine", () => {
  describe("normalizeAssessmentLevel", () => {
    it("normalizes aliases and unknown levels", () => {
      expect(normalizeAssessmentLevel("md5l")).toBe("MD5");
      expect(normalizeAssessmentLevel("doctor postgraduate")).toBe("POSTGRADUATE");
      expect(normalizeAssessmentLevel("unknown")).toBe("MD3");
    });
  });

  describe("getAssessmentLevel", () => {
    it("returns level metadata", () => {
      const level = getAssessmentLevel("resident");
      expect(level.id).toBe("RESIDENT");
      expect(level.minDifficulty).toBeGreaterThanOrEqual(1);
      expect(level.maxDifficulty).toBeLessThanOrEqual(5);
    });
  });

  describe("selectAssessmentQuestions", () => {
    it("prioritizes in-band questions and respects count bounds", () => {
      const questions = [
        { id: "q1", stem: "A", options: ["1", "2"], difficulty: 4 },
        { id: "q2", stem: "B", options: ["1", "2"], difficulty: 4 },
        { id: "q3", stem: "C", options: ["1", "2"], difficulty: 5 },
        { id: "q4", stem: "D", options: ["1", "2"], difficulty: 3 },
        { id: "q5", stem: "E", options: ["1", "2"], difficulty: 2 },
      ];

      const selected = selectAssessmentQuestions(questions, { level: "RESIDENT", count: 5 });
      expect(selected).toHaveLength(5);
      // Resident in-band difficulty is 4-5, so at least two should come from this band.
      expect(selected.filter((q) => q.difficulty >= 4).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("computeWeaknessProfile", () => {
    it("computes sorted weakness topics and readiness score", () => {
      const responses = [
        { questionId: "q1", correct: false, timeSpentSec: 95, confidence: 2 },
        { questionId: "q2", correct: false, timeSpentSec: 80, confidence: 2 },
        { questionId: "q3", correct: true, timeSpentSec: 45, confidence: 4 },
      ];
      const questionMap = new Map([
        ["q1", { topicTags: ["cardiology"], difficulty: 4 }],
        ["q2", { topicTags: ["cardiology"], difficulty: 5 }],
        ["q3", { topicTags: ["renal"], difficulty: 3 }],
      ]);

      const profile = computeWeaknessProfile(responses, questionMap, "MD4");
      expect(profile.answeredCount).toBe(3);
      expect(profile.topicBreakdown[0].tag).toBe("cardiology");
      expect(profile.topicBreakdown[0].severity).toMatch(/CRITICAL|REINFORCE/);
      expect(profile.readinessScore).toBeGreaterThanOrEqual(0);
      expect(profile.readinessScore).toBeLessThanOrEqual(100);
    });
  });

  describe("buildRecommendationPlan", () => {
    it("creates targeted actions for weak topics", () => {
      const recommendations = buildRecommendationPlan({
        recommendedDailyMinutes: 90,
        topicBreakdown: [
          {
            tag: "cardiology",
            attempts: 8,
            accuracy: 45,
            avgTimeSec: 88,
            avgConfidence: 2.3,
            weaknessScore: 0.72,
            severity: "CRITICAL",
          },
        ],
      });

      expect(recommendations.priorityTopics).toContain("cardiology");
      expect(recommendations.actions[0].focusTag).toBe("cardiology");
      expect(recommendations.actions[0].drills.length).toBeGreaterThan(0);
    });
  });
});
