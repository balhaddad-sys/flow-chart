import { create } from "zustand";
import type { QuestionModel } from "../types/question";

interface QuizState {
  questions: QuestionModel[];
  currentIndex: number;
  answers: Map<string, number>; // questionId -> selectedIndex
  attemptIds: Map<string, string>; // questionId -> attemptId
  results: Map<string, boolean>; // questionId -> correct
  startTime: number;
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
  startTime: 0,
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
      startTime: Date.now(),
      isFinished: false,
      endedEarly: false,
    }),

  answerQuestion: (questionId, answerIndex, correct, attemptId) =>
    set((state) => {
      const answers = new Map(state.answers);
      const attemptIds = new Map(state.attemptIds);
      const results = new Map(state.results);
      answers.set(questionId, answerIndex);
      if (attemptId) {
        attemptIds.set(questionId, attemptId);
      }
      results.set(questionId, correct);
      return { answers, attemptIds, results };
    }),

  nextQuestion: () =>
    set((state) => ({
      currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
    })),

  prevQuestion: () =>
    set((state) => ({
      currentIndex: Math.max(state.currentIndex - 1, 0),
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
