/**
 * @file quiz-store.test.ts
 * @description Comprehensive tests for the quiz store — simulates real user
 * flows through quiz taking, navigation, and results.
 */

import { useQuizStore } from "./quiz-store";
import type { QuestionModel } from "../types/question";

// Reset store before each test
beforeEach(() => {
  useQuizStore.getState().reset();
});

function mockQuestion(overrides: Partial<QuestionModel> = {}): QuestionModel {
  return {
    id: overrides.id || `q-${Math.random().toString(36).slice(2, 8)}`,
    courseId: "course1",
    sectionId: "sec1",
    topicTags: ["cardiology"],
    difficulty: 3,
    type: "SBA",
    stem: "What is the function of the heart?",
    options: ["Pump blood", "Filter blood", "Store blood", "Digest food"],
    correctIndex: 0,
    explanation: {
      correctWhy: "The heart pumps blood through the circulatory system.",
      whyOthersWrong: ["Incorrect", "Incorrect", "Incorrect"],
      keyTakeaway: "The heart is a pump.",
    },
    sourceRef: { fileId: "f1", fileName: "test.pdf", sectionId: "s1", label: "Heart" },
    citations: [],
    stats: { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 },
    ...overrides,
  } as QuestionModel;
}

describe("Quiz Store", () => {
  describe("Initial state", () => {
    it("starts with empty state", () => {
      const state = useQuizStore.getState();
      expect(state.questions).toEqual([]);
      expect(state.currentIndex).toBe(0);
      expect(state.answers.size).toBe(0);
      expect(state.attemptIds.size).toBe(0);
      expect(state.results.size).toBe(0);
      expect(state.startTime).toBe(0);
      expect(state.isFinished).toBe(false);
    });
  });

  describe("USER FLOW: Start a quiz", () => {
    it("loads questions and resets state", () => {
      const questions = [mockQuestion({ id: "q1" }), mockQuestion({ id: "q2" })];

      useQuizStore.getState().startQuiz(questions);

      const state = useQuizStore.getState();
      expect(state.questions).toHaveLength(2);
      expect(state.currentIndex).toBe(0);
      expect(state.answers.size).toBe(0);
      expect(state.results.size).toBe(0);
      expect(state.startTime).toBeGreaterThan(0);
      expect(state.isFinished).toBe(false);
    });

    it("clears previous quiz data when starting new quiz", () => {
      // Start first quiz and answer
      const q1 = [mockQuestion({ id: "q1" })];
      useQuizStore.getState().startQuiz(q1);
      useQuizStore.getState().answerQuestion("q1", 0, true, "att1");

      // Start second quiz
      const q2 = [mockQuestion({ id: "q2" }), mockQuestion({ id: "q3" })];
      useQuizStore.getState().startQuiz(q2);

      const state = useQuizStore.getState();
      expect(state.questions).toHaveLength(2);
      expect(state.answers.size).toBe(0);
      expect(state.attemptIds.size).toBe(0);
      expect(state.results.size).toBe(0);
    });
  });

  describe("USER FLOW: Answer questions", () => {
    it("records answer, result, and attemptId", () => {
      const questions = [mockQuestion({ id: "q1" }), mockQuestion({ id: "q2" })];
      useQuizStore.getState().startQuiz(questions);

      useQuizStore.getState().answerQuestion("q1", 2, false, "attempt-1");

      const state = useQuizStore.getState();
      expect(state.answers.get("q1")).toBe(2);
      expect(state.results.get("q1")).toBe(false);
      expect(state.attemptIds.get("q1")).toBe("attempt-1");
    });

    it("handles answer without attemptId", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      useQuizStore.getState().answerQuestion("q1", 0, true);

      const state = useQuizStore.getState();
      expect(state.answers.get("q1")).toBe(0);
      expect(state.results.get("q1")).toBe(true);
      expect(state.attemptIds.has("q1")).toBe(false);
    });

    it("overwrites previous answer for same question", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      useQuizStore.getState().answerQuestion("q1", 0, false);
      useQuizStore.getState().answerQuestion("q1", 2, true, "att2");

      const state = useQuizStore.getState();
      expect(state.answers.get("q1")).toBe(2);
      expect(state.results.get("q1")).toBe(true);
      expect(state.attemptIds.get("q1")).toBe("att2");
    });
  });

  describe("USER FLOW: Navigate between questions", () => {
    it("moves forward through questions", () => {
      const questions = [mockQuestion({ id: "q1" }), mockQuestion({ id: "q2" }), mockQuestion({ id: "q3" })];
      useQuizStore.getState().startQuiz(questions);

      expect(useQuizStore.getState().currentIndex).toBe(0);

      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().currentIndex).toBe(1);

      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().currentIndex).toBe(2);
    });

    it("does not exceed last question", () => {
      const questions = [mockQuestion({ id: "q1" }), mockQuestion({ id: "q2" })];
      useQuizStore.getState().startQuiz(questions);

      useQuizStore.getState().nextQuestion();
      useQuizStore.getState().nextQuestion();
      useQuizStore.getState().nextQuestion(); // Beyond last

      expect(useQuizStore.getState().currentIndex).toBe(1); // Stays at last
    });

    it("moves backward through questions", () => {
      const questions = [mockQuestion({ id: "q1" }), mockQuestion({ id: "q2" }), mockQuestion({ id: "q3" })];
      useQuizStore.getState().startQuiz(questions);

      useQuizStore.getState().nextQuestion();
      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().currentIndex).toBe(2);

      useQuizStore.getState().prevQuestion();
      expect(useQuizStore.getState().currentIndex).toBe(1);

      useQuizStore.getState().prevQuestion();
      expect(useQuizStore.getState().currentIndex).toBe(0);
    });

    it("does not go below first question", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);

      useQuizStore.getState().prevQuestion();
      useQuizStore.getState().prevQuestion();

      expect(useQuizStore.getState().currentIndex).toBe(0);
    });
  });

  describe("USER FLOW: Current question helper", () => {
    it("returns the current question", () => {
      const q1 = mockQuestion({ id: "q1", stem: "First?" });
      const q2 = mockQuestion({ id: "q2", stem: "Second?" });
      useQuizStore.getState().startQuiz([q1, q2]);

      expect(useQuizStore.getState().currentQuestion()?.stem).toBe("First?");

      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().currentQuestion()?.stem).toBe("Second?");
    });

    it("returns null when no questions loaded", () => {
      expect(useQuizStore.getState().currentQuestion()).toBeNull();
    });
  });

  describe("USER FLOW: Finish quiz", () => {
    it("marks quiz as finished", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      useQuizStore.getState().answerQuestion("q1", 0, true);
      useQuizStore.getState().finishQuiz();

      expect(useQuizStore.getState().isFinished).toBe(true);
    });
  });

  describe("USER FLOW: Get attempt ID", () => {
    it("retrieves stored attempt ID", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      useQuizStore.getState().answerQuestion("q1", 0, true, "att-123");

      expect(useQuizStore.getState().getAttemptId("q1")).toBe("att-123");
    });

    it("returns null for unanswered question", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      expect(useQuizStore.getState().getAttemptId("q1")).toBeNull();
    });
  });

  describe("USER FLOW: Complete 10-question quiz", () => {
    it("simulates a student taking a full quiz", () => {
      const questions = Array.from({ length: 10 }, (_, i) =>
        mockQuestion({ id: `q${i}`, stem: `Question ${i}?` })
      );

      // Start quiz
      useQuizStore.getState().startQuiz(questions);
      const startTime = useQuizStore.getState().startTime;
      expect(startTime).toBeGreaterThan(0);

      // Answer all questions
      for (let i = 0; i < 10; i++) {
        const correct = i % 3 !== 0; // 6 correct (1,2,4,5,7,8), 4 wrong (0,3,6,9)
        useQuizStore.getState().answerQuestion(`q${i}`, correct ? 0 : 1, correct, `att${i}`);
        if (i < 9) useQuizStore.getState().nextQuestion();
      }

      // Verify state
      const state = useQuizStore.getState();
      expect(state.answers.size).toBe(10);
      expect(state.results.size).toBe(10);
      expect(state.attemptIds.size).toBe(10);
      expect(state.currentIndex).toBe(9); // Last question

      // Count correct
      let correctCount = 0;
      state.results.forEach((correct) => { if (correct) correctCount++; });
      expect(correctCount).toBe(6);

      // Finish
      useQuizStore.getState().finishQuiz();
      expect(useQuizStore.getState().isFinished).toBe(true);
    });
  });

  describe("Reset", () => {
    it("clears all state back to initial", () => {
      useQuizStore.getState().startQuiz([mockQuestion({ id: "q1" })]);
      useQuizStore.getState().answerQuestion("q1", 0, true, "att1");
      useQuizStore.getState().finishQuiz();

      useQuizStore.getState().reset();

      const state = useQuizStore.getState();
      expect(state.questions).toEqual([]);
      expect(state.answers.size).toBe(0);
      expect(state.isFinished).toBe(false);
      expect(state.startTime).toBe(0);
    });
  });
});
