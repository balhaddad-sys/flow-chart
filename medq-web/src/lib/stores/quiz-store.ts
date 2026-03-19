import { create } from "zustand";
import type { QuestionModel } from "../types/question";

interface QuizState {
  questions: QuestionModel[];
  currentIndex: number;
  answers: Map<string, number>; // questionId -> selectedIndex
  attemptIds: Map<string, string>; // questionId -> attemptId
  results: Map<string, boolean>; // questionId -> correct
  questionTimes: Map<string, number>; // questionId -> seconds spent on that question
  startTime: number; // quiz-level start (for total duration)
  questionStartTime: number; // per-question start (reset on each navigation)
  isFinished: boolean;
  endedEarly: boolean;
}

interface QuizStore extends QuizState {
  startQuiz: (questions: QuestionModel[]) => void;
  answerQuestion: (
    questionId: string,
    answerIndex: number,
    correct: boolean,
    attemptId?: string
  ) => void;
  /** Returns per-question elapsed seconds for the given question */
  getQuestionElapsed: (questionId: string) => number;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => void;
  finishQuizEarly: () => void;
  reset: () => void;
  getAttemptId: (questionId: string) => string | null;
  currentQuestion: () => QuestionModel | null;
}

const initialState: QuizState = {
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  attemptIds: new Map(),
  results: new Map(),
  questionTimes: new Map(),
  startTime: 0,
  questionStartTime: 0,
  isFinished: false,
  endedEarly: false,
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  ...initialState,

  startQuiz: (questions) =>
    set({
      questions,
      currentIndex: 0,
      answers: new Map(),
      attemptIds: new Map(),
      results: new Map(),
      questionTimes: new Map(),
      startTime: Date.now(),
      questionStartTime: Date.now(),
      isFinished: false,
      endedEarly: false,
    }),

  answerQuestion: (questionId, answerIndex, correct, attemptId) =>
    set((state) => {
      const answers = new Map(state.answers);
      const attemptIds = new Map(state.attemptIds);
      const results = new Map(state.results);
      const questionTimes = new Map(state.questionTimes);
      answers.set(questionId, answerIndex);
      if (attemptId) {
        attemptIds.set(questionId, attemptId);
      }
      results.set(questionId, correct);
      // Record per-question time: seconds since questionStartTime
      if (!questionTimes.has(questionId)) {
        const elapsed = Math.round((Date.now() - state.questionStartTime) / 1000);
        questionTimes.set(questionId, Math.min(elapsed, 3600));
      }
      return { answers, attemptIds, results, questionTimes };
    }),

  getQuestionElapsed: (questionId) => {
    const { questionTimes, questionStartTime } = get();
    // If already answered, return recorded time; otherwise return live elapsed
    if (questionTimes.has(questionId)) return questionTimes.get(questionId)!;
    return Math.round((Date.now() - questionStartTime) / 1000);
  },

  nextQuestion: () =>
    set((state) => ({
      currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
      questionStartTime: Date.now(), // reset per-question timer
    })),

  prevQuestion: () =>
    set((state) => ({
      currentIndex: Math.max(state.currentIndex - 1, 0),
      questionStartTime: Date.now(), // reset per-question timer
    })),

  finishQuiz: () => set({ isFinished: true }),
  finishQuizEarly: () => set({ isFinished: true, endedEarly: true }),

  reset: () => set(initialState),

  getAttemptId: (questionId) => {
    const { attemptIds } = get();
    return attemptIds.get(questionId) ?? null;
  },

  currentQuestion: () => {
    const { questions, currentIndex } = get();
    return questions[currentIndex] ?? null;
  },
}));
