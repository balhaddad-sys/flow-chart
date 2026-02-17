/**
 * @file explore-store.test.ts
 * @description Comprehensive tests for the explore store — simulates real user
 * flows through the explore quiz feature including background question generation.
 */

import { useExploreStore } from "./explore-store";
import type { ExploreQuestion } from "../firebase/functions";

beforeEach(() => {
  useExploreStore.getState().reset();
});

function mockExploreQuestion(overrides: Partial<ExploreQuestion> = {}): ExploreQuestion {
  const id = overrides.id || `eq-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    stem: overrides.stem || `What about ${id}?`,
    options: overrides.options || ["A", "B", "C", "D"],
    correctIndex: overrides.correctIndex ?? 0,
    difficulty: overrides.difficulty ?? 3,
    topicTags: overrides.topicTags || ["cardiology"],
    explanation: {
      correctWhy: "Because it's correct.",
      whyOthersWrong: ["Wrong", "Wrong", "Wrong"],
      keyTakeaway: "Key point.",
    },
    citations: [],
    ...overrides,
  } as ExploreQuestion;
}

describe("Explore Store", () => {
  describe("Initial state", () => {
    it("starts in setup phase with defaults", () => {
      const state = useExploreStore.getState();
      expect(state.phase).toBe("setup");
      expect(state.topic).toBe("");
      expect(state.level).toBe("MD3");
      expect(state.questions).toEqual([]);
      expect(state.currentIndex).toBe(0);
      expect(state.answers.size).toBe(0);
      expect(state.confidence.size).toBe(0);
      expect(state.results.size).toBe(0);
      expect(state.backgroundJobId).toBeNull();
      expect(state.backfillStatus).toBe("idle");
      expect(state.error).toBeNull();
    });
  });

  describe("USER FLOW: Start loading", () => {
    it("transitions to loading phase with topic and level", () => {
      useExploreStore.getState().startLoading("Cardiac Arrhythmias", "MD4");

      const state = useExploreStore.getState();
      expect(state.phase).toBe("loading");
      expect(state.topic).toBe("Cardiac Arrhythmias");
      expect(state.level).toBe("MD4");
      expect(state.error).toBeNull();
    });
  });

  describe("USER FLOW: Start quiz with initial questions", () => {
    it("transitions to quiz phase with fast-start questions", () => {
      const questions = [
        mockExploreQuestion({ id: "eq1" }),
        mockExploreQuestion({ id: "eq2" }),
        mockExploreQuestion({ id: "eq3" }),
      ];

      useExploreStore.getState().startQuiz(
        questions,
        "Heart Failure",
        "MD3",
        "MD3 (Clinical Core)",
        {
          targetCount: 10,
          backgroundJobId: "job-123",
          backfillStatus: "running",
          modelUsed: "gemini-2.0-flash",
          qualityGatePassed: true,
          qualityScore: 0.85,
        }
      );

      const state = useExploreStore.getState();
      expect(state.phase).toBe("quiz");
      expect(state.questions).toHaveLength(3);
      expect(state.topic).toBe("Heart Failure");
      expect(state.level).toBe("MD3");
      expect(state.levelLabel).toBe("MD3 (Clinical Core)");
      expect(state.targetCount).toBe(10);
      expect(state.backgroundJobId).toBe("job-123");
      expect(state.backfillStatus).toBe("running");
      expect(state.modelUsed).toBe("gemini-2.0-flash");
      expect(state.qualityGatePassed).toBe(true);
      expect(state.qualityScore).toBe(0.85);
      expect(state.currentIndex).toBe(0);
      expect(state.answers.size).toBe(0);
      expect(state.confidence.size).toBe(0);
    });
  });

  describe("USER FLOW: Answer explore questions", () => {
    it("records answers and checks correctness client-side", () => {
      const questions = [
        mockExploreQuestion({ id: "eq1", correctIndex: 2 }),
        mockExploreQuestion({ id: "eq2", correctIndex: 0 }),
      ];

      useExploreStore.getState().startQuiz(questions, "Topic", "MD3", "MD3", {});

      // Answer first question correctly
      useExploreStore.getState().setConfidence("eq1", 5);
      useExploreStore.getState().answerQuestion("eq1", 2);
      expect(useExploreStore.getState().answers.get("eq1")).toBe(2);
      expect(useExploreStore.getState().confidence.get("eq1")).toBe(5);
      expect(useExploreStore.getState().results.get("eq1")).toBe(true);

      // Answer second question incorrectly
      useExploreStore.getState().answerQuestion("eq2", 3, 2);
      expect(useExploreStore.getState().answers.get("eq2")).toBe(3);
      expect(useExploreStore.getState().confidence.get("eq2")).toBe(2);
      expect(useExploreStore.getState().results.get("eq2")).toBe(false);
    });

    it("ignores answer for non-existent question", () => {
      useExploreStore.getState().startQuiz([mockExploreQuestion({ id: "eq1" })], "T", "MD3", "L", {});
      useExploreStore.getState().answerQuestion("nonexistent", 0);

      expect(useExploreStore.getState().answers.size).toBe(0);
    });

    it("clamps confidence to 1..5", () => {
      useExploreStore.getState().startQuiz([mockExploreQuestion({ id: "eq1" })], "T", "MD3", "L", {});
      useExploreStore.getState().setConfidence("eq1", 99);
      expect(useExploreStore.getState().confidence.get("eq1")).toBe(5);

      useExploreStore.getState().setConfidence("eq1", -1);
      expect(useExploreStore.getState().confidence.get("eq1")).toBe(1);
    });
  });

  describe("USER FLOW: Background question sync (backfill)", () => {
    it("appends background questions without duplicates", () => {
      const initial = [
        mockExploreQuestion({ id: "eq1", stem: "What is X?" }),
        mockExploreQuestion({ id: "eq2", stem: "What is Y?" }),
      ];

      useExploreStore.getState().startQuiz(initial, "Topic", "MD3", "MD3", { targetCount: 5 });

      // Background generates more questions (including one duplicate stem)
      const backfill = [
        mockExploreQuestion({ id: "eq3", stem: "What is Z?" }),
        mockExploreQuestion({ id: "eq4", stem: "What is X?" }), // Duplicate stem
        mockExploreQuestion({ id: "eq5", stem: "What is W?" }),
      ];

      useExploreStore.getState().syncBackgroundQuestions(backfill, { targetCount: 5 });

      const state = useExploreStore.getState();
      expect(state.questions).toHaveLength(4); // 2 initial + 2 new (duplicate filtered)

      const stems = state.questions.map((q) => q.stem);
      expect(stems).toContain("What is Z?");
      expect(stems).toContain("What is W?");
    });

    it("updates metadata even when no new questions", () => {
      useExploreStore.getState().startQuiz(
        [mockExploreQuestion({ id: "eq1" })],
        "T", "MD3", "L",
        { modelUsed: "gemini" }
      );

      useExploreStore.getState().syncBackgroundQuestions([], {
        modelUsed: "claude",
        qualityGatePassed: true,
        qualityScore: 0.9,
        targetCount: 10,
      });

      const state = useExploreStore.getState();
      expect(state.modelUsed).toBe("claude");
      expect(state.qualityGatePassed).toBe(true);
      expect(state.qualityScore).toBe(0.9);
      expect(state.targetCount).toBe(10);
    });

    it("handles empty incoming array gracefully", () => {
      useExploreStore.getState().startQuiz(
        [mockExploreQuestion({ id: "eq1" })], "T", "MD3", "L", {}
      );

      useExploreStore.getState().syncBackgroundQuestions([]);
      expect(useExploreStore.getState().questions).toHaveLength(1);
    });
  });

  describe("USER FLOW: Navigate explore quiz", () => {
    it("moves forward but not past last question", () => {
      const qs = [mockExploreQuestion({ id: "eq1" }), mockExploreQuestion({ id: "eq2" })];
      useExploreStore.getState().startQuiz(qs, "T", "MD3", "L", {});

      useExploreStore.getState().nextQuestion();
      expect(useExploreStore.getState().currentIndex).toBe(1);

      useExploreStore.getState().nextQuestion();
      expect(useExploreStore.getState().currentIndex).toBe(1); // Capped
    });
  });

  describe("USER FLOW: Finish and see results", () => {
    it("transitions to results phase", () => {
      const qs = [mockExploreQuestion({ id: "eq1" })];
      useExploreStore.getState().startQuiz(qs, "T", "MD3", "L", {});
      useExploreStore.getState().answerQuestion("eq1", 0);
      useExploreStore.getState().finishQuiz();

      expect(useExploreStore.getState().phase).toBe("results");
    });
  });

  describe("USER FLOW: Resume quiz after viewing results", () => {
    it("goes back to quiz phase at first unanswered question", () => {
      const qs = [
        mockExploreQuestion({ id: "eq1" }),
        mockExploreQuestion({ id: "eq2" }),
        mockExploreQuestion({ id: "eq3" }),
      ];

      useExploreStore.getState().startQuiz(qs, "T", "MD3", "L", {});
      useExploreStore.getState().answerQuestion("eq1", 0);
      useExploreStore.getState().finishQuiz();

      // Resume — should go to eq2 (first unanswered)
      useExploreStore.getState().resumeQuiz();

      const state = useExploreStore.getState();
      expect(state.phase).toBe("quiz");
      expect(state.currentIndex).toBe(1); // eq2 is index 1
    });

    it("stays at current index if all answered", () => {
      const qs = [mockExploreQuestion({ id: "eq1" }), mockExploreQuestion({ id: "eq2" })];
      useExploreStore.getState().startQuiz(qs, "T", "MD3", "L", {});
      useExploreStore.getState().answerQuestion("eq1", 0);
      useExploreStore.getState().answerQuestion("eq2", 1);
      useExploreStore.getState().finishQuiz();

      useExploreStore.getState().resumeQuiz();
      const state = useExploreStore.getState();
      expect(state.phase).toBe("quiz");
      // All answered → stays at min of currentIndex or last valid index
      expect(state.currentIndex).toBeLessThanOrEqual(1);
    });
  });

  describe("USER FLOW: Backfill status tracking", () => {
    it("tracks backfill lifecycle", () => {
      useExploreStore.getState().setBackfillStatus("running");
      expect(useExploreStore.getState().backfillStatus).toBe("running");

      useExploreStore.getState().setBackfillStatus("completed");
      expect(useExploreStore.getState().backfillStatus).toBe("completed");
    });

    it("tracks backfill error", () => {
      useExploreStore.getState().setBackfillStatus("failed", "AI timeout");
      expect(useExploreStore.getState().backfillStatus).toBe("failed");
      expect(useExploreStore.getState().backfillError).toBe("AI timeout");
    });
  });

  describe("USER FLOW: Error handling", () => {
    it("setError resets to setup phase with message", () => {
      useExploreStore.getState().startLoading("Topic", "MD3");
      useExploreStore.getState().setError("AI failed to generate questions");

      const state = useExploreStore.getState();
      expect(state.phase).toBe("setup");
      expect(state.error).toBe("AI failed to generate questions");
    });
  });

  describe("USER FLOW: Full explore session (10 questions)", () => {
    it("simulates a complete explore quiz with background sync", () => {
      // Phase 1: Loading
      useExploreStore.getState().startLoading("Renal Physiology", "MD2");
      expect(useExploreStore.getState().phase).toBe("loading");

      // Phase 2: Fast-start with 3 questions
      const fastStart = Array.from({ length: 3 }, (_, i) =>
        mockExploreQuestion({ id: `eq${i}`, stem: `Fast Q${i}?`, correctIndex: i % 4 })
      );

      useExploreStore.getState().startQuiz(fastStart, "Renal Physiology", "MD2", "MD2 (Integrated)", {
        targetCount: 10,
        backgroundJobId: "job-abc",
        backfillStatus: "running",
        modelUsed: "gemini-2.0-flash",
      });

      expect(useExploreStore.getState().phase).toBe("quiz");
      expect(useExploreStore.getState().questions).toHaveLength(3);

      // Answer first 3
      for (let i = 0; i < 3; i++) {
        useExploreStore.getState().answerQuestion(`eq${i}`, i % 4);
        if (i < 2) useExploreStore.getState().nextQuestion();
      }

      // Phase 3: Background sync adds 7 more
      const backfill = Array.from({ length: 7 }, (_, i) =>
        mockExploreQuestion({ id: `eq${i + 3}`, stem: `Backfill Q${i + 3}?`, correctIndex: i % 4 })
      );

      useExploreStore.getState().syncBackgroundQuestions(backfill, {
        targetCount: 10,
        backfillStatus: "completed",
      });

      expect(useExploreStore.getState().questions).toHaveLength(10);
      useExploreStore.getState().setBackfillStatus("completed");

      // Answer remaining 7
      for (let i = 3; i < 10; i++) {
        useExploreStore.getState().nextQuestion();
        useExploreStore.getState().answerQuestion(`eq${i}`, i % 4);
      }

      expect(useExploreStore.getState().answers.size).toBe(10);

      // Phase 4: Finish and see results
      useExploreStore.getState().finishQuiz();
      expect(useExploreStore.getState().phase).toBe("results");

      // Count correct answers
      let correct = 0;
      useExploreStore.getState().results.forEach((v) => { if (v) correct++; });
      expect(correct).toBeGreaterThan(0);
    });
  });

  describe("USER FLOW: Teaching phase transitions", () => {
    const mockInsight = {
      topic: "Heart Failure",
      level: "MD3",
      levelLabel: "MD3",
      modelUsed: "gemini",
      summary: "Heart failure overview.",
      teachingSections: [{ id: "overview", title: "Overview", content: "Detailed content.", keyPoints: ["Point 1"] }],
      corePoints: ["Core 1"],
      clinicalFramework: { pathophysiology: "Mechanism.", diagnosticApproach: ["Step 1"], managementApproach: ["Treat 1"], escalationTriggers: ["Flag 1"] },
      chartData: {},
      clinicalPitfalls: ["Pitfall 1"],
      redFlags: ["Red flag 1"],
      studyApproach: ["Study step 1"],
      guidelineUpdates: [],
      citations: [],
    };

    it("transitions from loading to teaching with startTeaching", () => {
      useExploreStore.getState().startLoading("Heart Failure", "MD3");
      useExploreStore.getState().startTeaching(mockInsight);

      const state = useExploreStore.getState();
      expect(state.phase).toBe("teaching");
      expect(state.topicInsight).toBe(mockInsight);
      expect(state.insightLoading).toBe(false);
      expect(state.insightError).toBeNull();
    });

    it("goToQuizFromTeaching sets loading when no questions loaded", () => {
      useExploreStore.getState().startTeaching(mockInsight);
      useExploreStore.getState().goToQuizFromTeaching();

      expect(useExploreStore.getState().phase).toBe("loading");
    });

    it("goToQuizFromTeaching sets quiz when questions already loaded", () => {
      useExploreStore.getState().startQuiz(
        [mockExploreQuestion({ id: "eq1" })], "HF", "MD3", "MD3", {}
      );
      useExploreStore.getState().startTeaching(mockInsight);
      useExploreStore.getState().goToQuizFromTeaching();

      expect(useExploreStore.getState().phase).toBe("quiz");
    });

    it("goToTeachingFromQuiz preserves quiz state", () => {
      useExploreStore.getState().setTopicInsight(mockInsight);
      const qs = [mockExploreQuestion({ id: "eq1" }), mockExploreQuestion({ id: "eq2" })];
      useExploreStore.getState().startQuiz(qs, "HF", "MD3", "MD3", {});
      useExploreStore.getState().answerQuestion("eq1", 0);
      useExploreStore.getState().nextQuestion();

      useExploreStore.getState().goToTeachingFromQuiz();

      const state = useExploreStore.getState();
      expect(state.phase).toBe("teaching");
      expect(state.answers.size).toBe(1);
      expect(state.currentIndex).toBe(1);
    });

    it("goToTeachingFromQuiz does nothing without insight", () => {
      useExploreStore.getState().startQuiz(
        [mockExploreQuestion({ id: "eq1" })], "HF", "MD3", "MD3", {}
      );
      useExploreStore.getState().goToTeachingFromQuiz();

      expect(useExploreStore.getState().phase).toBe("quiz");
    });

    it("tracks userPath", () => {
      useExploreStore.getState().setUserPath("learn");
      expect(useExploreStore.getState().userPath).toBe("learn");

      useExploreStore.getState().setUserPath("quiz");
      expect(useExploreStore.getState().userPath).toBe("quiz");
    });
  });

  describe("Reset", () => {
    it("clears everything back to setup defaults", () => {
      useExploreStore.getState().startQuiz(
        [mockExploreQuestion({ id: "eq1" })],
        "Topic",
        "MD4",
        "MD4 (Advanced)",
        { backgroundJobId: "job-1", modelUsed: "claude" }
      );

      useExploreStore.getState().reset();

      const state = useExploreStore.getState();
      expect(state.phase).toBe("setup");
      expect(state.topic).toBe("");
      expect(state.level).toBe("MD3");
      expect(state.questions).toEqual([]);
      expect(state.backgroundJobId).toBeNull();
      expect(state.backfillStatus).toBe("idle");
      expect(state.modelUsed).toBe("");
      expect(state.userPath).toBeNull();
      expect(state.topicInsight).toBeNull();
      expect(state.insightLoading).toBe(false);
      expect(state.insightError).toBeNull();
    });
  });
});
