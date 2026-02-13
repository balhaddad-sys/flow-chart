import { create } from "zustand";
import type { QuestionModel } from "../types/question";

interface QuizState {
  questions: QuestionModel[];
  currentIndex: number;
  answers: Map<string, number>; // questionId -> selectedIndex
  results: Map<string, boolean>; // questionId -> correct
  startTime: number;
  isFinished: boolean;
}

interface QuizStore extends QuizState {
  startQuiz: (questions: QuestionModel[]) => void;
  answerQuestion: (questionId: string, answerIndex: number, correct: boolean) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => void;
  reset: () => void;
  currentQuestion: () => QuestionModel | null;
}

const initialState: QuizState = {
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  results: new Map(),
  startTime: 0,
  isFinished: false,
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  ...initialState,

  startQuiz: (questions) =>
    set({
      questions,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      startTime: Date.now(),
      isFinished: false,
    }),

  answerQuestion: (questionId, answerIndex, correct) =>
    set((state) => {
      const answers = new Map(state.answers);
      const results = new Map(state.results);
      answers.set(questionId, answerIndex);
      results.set(questionId, correct);
      return { answers, results };
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

  reset: () => set(initialState),

  currentQuestion: () => {
    const { questions, currentIndex } = get();
    return questions[currentIndex] ?? null;
  },
}));
