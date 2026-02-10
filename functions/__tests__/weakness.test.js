const {
  accumulateTopicStats,
  rankWeakTopics,
  computeOverallAccuracy,
  computeCompletionStats,
} = require("../analytics/weakness");

describe("analytics/weakness", () => {
  // ── accumulateTopicStats ────────────────────────────────────────────────────

  describe("accumulateTopicStats", () => {
    it("accumulates per-topic statistics from attempts", () => {
      const questionMap = new Map([
        ["q1", { topicTags: ["cardio", "anatomy"] }],
        ["q2", { topicTags: ["neuro"] }],
      ]);

      const attempts = [
        { questionId: "q1", correct: true, timeSpentSec: 30 },
        { questionId: "q1", correct: false, timeSpentSec: 45 },
        { questionId: "q2", correct: false, timeSpentSec: 60 },
      ];

      const topicMap = accumulateTopicStats(attempts, questionMap);

      expect(topicMap.get("cardio").totalAttempts).toBe(2);
      expect(topicMap.get("cardio").wrongAttempts).toBe(1);
      expect(topicMap.get("cardio").totalTimeSec).toBe(75);

      expect(topicMap.get("anatomy").totalAttempts).toBe(2);
      expect(topicMap.get("neuro").totalAttempts).toBe(1);
      expect(topicMap.get("neuro").wrongAttempts).toBe(1);
    });

    it("skips attempts with unknown questionId", () => {
      const questionMap = new Map([["q1", { topicTags: ["cardio"] }]]);
      const attempts = [
        { questionId: "q1", correct: true, timeSpentSec: 10 },
        { questionId: "unknown", correct: false, timeSpentSec: 20 },
      ];

      const topicMap = accumulateTopicStats(attempts, questionMap);
      expect(topicMap.get("cardio").totalAttempts).toBe(1);
      expect(topicMap.size).toBe(1);
    });

    it("handles empty topicTags gracefully", () => {
      const questionMap = new Map([["q1", { topicTags: [] }]]);
      const attempts = [{ questionId: "q1", correct: true, timeSpentSec: 10 }];

      const topicMap = accumulateTopicStats(attempts, questionMap);
      expect(topicMap.size).toBe(0);
    });

    it("tracks lastAttemptDate from createdAt", () => {
      const questionMap = new Map([["q1", { topicTags: ["cardio"] }]]);
      const date1 = new Date("2025-01-01");
      const date2 = new Date("2025-01-15");

      const attempts = [
        { questionId: "q1", correct: true, timeSpentSec: 10, createdAt: { toDate: () => date1 } },
        { questionId: "q1", correct: true, timeSpentSec: 10, createdAt: { toDate: () => date2 } },
      ];

      const topicMap = accumulateTopicStats(attempts, questionMap);
      expect(topicMap.get("cardio").lastAttemptDate).toEqual(date2);
    });

    it("returns empty map for empty attempts", () => {
      const topicMap = accumulateTopicStats([], new Map());
      expect(topicMap.size).toBe(0);
    });
  });

  // ── rankWeakTopics ──────────────────────────────────────────────────────────

  describe("rankWeakTopics", () => {
    it("ranks topics by weakness score (descending)", () => {
      const topicMap = new Map([
        ["cardio", { totalAttempts: 10, wrongAttempts: 8, totalTimeSec: 100, lastAttemptDate: new Date("2025-01-01") }],
        ["neuro", { totalAttempts: 10, wrongAttempts: 2, totalTimeSec: 600, lastAttemptDate: new Date("2025-01-14") }],
        ["renal", { totalAttempts: 10, wrongAttempts: 5, totalTimeSec: 300, lastAttemptDate: new Date("2025-01-07") }],
      ]);

      const now = new Date("2025-01-15");
      const ranked = rankWeakTopics(topicMap, now, 10);

      expect(ranked[0].tag).toBe("cardio"); // highest error rate
      expect(ranked.length).toBe(3);
      expect(ranked[0].weaknessScore).toBeGreaterThan(ranked[1].weaknessScore);
    });

    it("respects the limit parameter", () => {
      const topicMap = new Map([
        ["a", { totalAttempts: 10, wrongAttempts: 9, totalTimeSec: 10, lastAttemptDate: null }],
        ["b", { totalAttempts: 10, wrongAttempts: 8, totalTimeSec: 10, lastAttemptDate: null }],
        ["c", { totalAttempts: 10, wrongAttempts: 7, totalTimeSec: 10, lastAttemptDate: null }],
      ]);

      const ranked = rankWeakTopics(topicMap, new Date(), 2);
      expect(ranked).toHaveLength(2);
    });

    it("computes accuracy correctly", () => {
      const topicMap = new Map([
        ["cardio", { totalAttempts: 10, wrongAttempts: 3, totalTimeSec: 0, lastAttemptDate: null }],
      ]);

      const ranked = rankWeakTopics(topicMap, new Date(), 10);
      expect(ranked[0].accuracy).toBeCloseTo(0.7);
    });

    it("handles empty topicMap", () => {
      const ranked = rankWeakTopics(new Map(), new Date(), 5);
      expect(ranked).toEqual([]);
    });
  });

  // ── computeOverallAccuracy ──────────────────────────────────────────────────

  describe("computeOverallAccuracy", () => {
    it("computes totals and accuracy", () => {
      const attempts = [
        { correct: true },
        { correct: true },
        { correct: false },
        { correct: true },
      ];

      const result = computeOverallAccuracy(attempts);
      expect(result.totalAnswered).toBe(4);
      expect(result.totalCorrect).toBe(3);
      expect(result.overallAccuracy).toBeCloseTo(0.75);
    });

    it("returns 0 accuracy for empty attempts", () => {
      const result = computeOverallAccuracy([]);
      expect(result.totalAnswered).toBe(0);
      expect(result.totalCorrect).toBe(0);
      expect(result.overallAccuracy).toBe(0);
    });

    it("returns 1.0 for all correct", () => {
      const attempts = [{ correct: true }, { correct: true }];
      expect(computeOverallAccuracy(attempts).overallAccuracy).toBe(1);
    });

    it("returns 0.0 for all wrong", () => {
      const attempts = [{ correct: false }, { correct: false }];
      expect(computeOverallAccuracy(attempts).overallAccuracy).toBe(0);
    });
  });

  // ── computeCompletionStats ──────────────────────────────────────────────────

  describe("computeCompletionStats", () => {
    it("counts completed tasks and study minutes", () => {
      const tasks = [
        { status: "DONE", actualMinutes: 30, estMinutes: 20 },
        { status: "DONE", estMinutes: 15 },
        { status: "TODO", estMinutes: 25 },
      ];

      const result = computeCompletionStats(tasks);
      expect(result.completedTasks).toBe(2);
      expect(result.totalTasks).toBe(3);
      expect(result.totalStudyMinutes).toBe(45); // 30 + 15
      expect(result.completionPercent).toBeCloseTo(2 / 3);
    });

    it("prefers actualMinutes over estMinutes for DONE tasks", () => {
      const tasks = [{ status: "DONE", actualMinutes: 50, estMinutes: 20 }];
      expect(computeCompletionStats(tasks).totalStudyMinutes).toBe(50);
    });

    it("returns zero stats for empty tasks", () => {
      const result = computeCompletionStats([]);
      expect(result.completedTasks).toBe(0);
      expect(result.totalTasks).toBe(0);
      expect(result.totalStudyMinutes).toBe(0);
      expect(result.completionPercent).toBe(0);
    });
  });
});
