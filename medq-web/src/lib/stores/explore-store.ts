import { create } from "zustand";
import type { ExploreQuestion } from "../firebase/functions";

type Phase = "setup" | "loading" | "quiz" | "results";

interface ExploreStore {
  phase: Phase;
  topic: string;
  level: string;
  levelLabel: string;
  questions: ExploreQuestion[];
  currentIndex: number;
  answers: Map<string, number>;
  results: Map<string, boolean>;
  error: string | null;

  startLoading: (topic: string, level: string) => void;
  startQuiz: (
    questions: ExploreQuestion[],
    topic: string,
    level: string,
    levelLabel: string
  ) => void;
  answerQuestion: (questionId: string, answerIndex: number) => void;
  nextQuestion: () => void;
  finishQuiz: () => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useExploreStore = create<ExploreStore>((set, get) => ({
  phase: "setup",
  topic: "",
  level: "MD3",
  levelLabel: "",
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  results: new Map(),
  error: null,

  startLoading: (topic, level) =>
    set({ phase: "loading", topic, level, error: null }),

  startQuiz: (questions, topic, level, levelLabel) =>
    set({
      phase: "quiz",
      questions,
      topic,
      level,
      levelLabel,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      error: null,
    }),

  answerQuestion: (questionId, answerIndex) => {
    const { questions, answers, results } = get();
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;
    const nextAnswers = new Map(answers);
    const nextResults = new Map(results);
    nextAnswers.set(questionId, answerIndex);
    nextResults.set(questionId, answerIndex === q.correctIndex);
    set({ answers: nextAnswers, results: nextResults });
  },

  nextQuestion: () =>
    set((state) => ({
      currentIndex: Math.min(
        state.currentIndex + 1,
        state.questions.length - 1
      ),
    })),

  finishQuiz: () => set({ phase: "results" }),

  setError: (msg) => set({ phase: "setup", error: msg }),

  reset: () =>
    set({
      phase: "setup",
      topic: "",
      level: "MD3",
      levelLabel: "",
      questions: [],
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      error: null,
    }),
}));
