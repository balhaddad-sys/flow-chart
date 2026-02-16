import { create } from "zustand";
import type { ExploreQuestion } from "../firebase/functions";

type Phase = "setup" | "loading" | "quiz" | "results";
type BackfillStatus = "idle" | "running" | "completed" | "failed";

interface ExploreMeta {
  targetCount?: number;
  backgroundJobId?: string | null;
  backfillStatus?: BackfillStatus;
  modelUsed?: string;
  qualityGatePassed?: boolean;
  qualityScore?: number;
}

interface ExploreStore {
  phase: Phase;
  topic: string;
  level: string;
  levelLabel: string;
  targetCount: number;
  questions: ExploreQuestion[];
  currentIndex: number;
  answers: Map<string, number>;
  results: Map<string, boolean>;
  modelUsed: string;
  qualityGatePassed?: boolean;
  qualityScore?: number;
  backgroundJobId: string | null;
  backfillStatus: BackfillStatus;
  backfillError: string | null;
  error: string | null;

  startLoading: (topic: string, level: string) => void;
  startQuiz: (
    questions: ExploreQuestion[],
    topic: string,
    level: string,
    levelLabel: string,
    meta?: ExploreMeta
  ) => void;
  syncBackgroundQuestions: (questions: ExploreQuestion[], meta?: ExploreMeta) => void;
  answerQuestion: (questionId: string, answerIndex: number) => void;
  nextQuestion: () => void;
  finishQuiz: () => void;
  resumeQuiz: () => void;
  setBackfillStatus: (status: BackfillStatus, error?: string | null) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

function stemKey(stem: string) {
  return String(stem || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export const useExploreStore = create<ExploreStore>((set, get) => ({
  phase: "setup",
  topic: "",
  level: "MD3",
  levelLabel: "",
  targetCount: 0,
  questions: [],
  currentIndex: 0,
  answers: new Map(),
  results: new Map(),
  modelUsed: "",
  qualityGatePassed: undefined,
  qualityScore: undefined,
  backgroundJobId: null,
  backfillStatus: "idle",
  backfillError: null,
  error: null,

  startLoading: (topic, level) =>
    set({
      phase: "loading",
      topic,
      level,
      error: null,
      backfillError: null,
    }),

  startQuiz: (questions, topic, level, levelLabel, meta) =>
    set({
      phase: "quiz",
      questions,
      topic,
      level,
      levelLabel,
      targetCount: Math.max(questions.length, meta?.targetCount ?? questions.length),
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      modelUsed: meta?.modelUsed || "",
      qualityGatePassed: meta?.qualityGatePassed,
      qualityScore: meta?.qualityScore,
      backgroundJobId: meta?.backgroundJobId || null,
      backfillStatus: meta?.backfillStatus || "idle",
      backfillError: null,
      error: null,
    }),

  syncBackgroundQuestions: (incoming, meta) => {
    if (!Array.isArray(incoming) || incoming.length === 0) {
      if (meta) {
        set((state) => ({
          targetCount: Math.max(
            state.targetCount,
            meta.targetCount ?? state.targetCount
          ),
          modelUsed: meta.modelUsed || state.modelUsed,
          qualityGatePassed:
            meta.qualityGatePassed ?? state.qualityGatePassed,
          qualityScore: meta.qualityScore ?? state.qualityScore,
        }));
      }
      return;
    }

    set((state) => {
      const existingStemKeys = new Set(
        state.questions.map((q) => stemKey(q.stem)).filter(Boolean)
      );
      const appended = incoming.filter((q) => {
        const key = stemKey(q.stem);
        if (!key || existingStemKeys.has(key)) return false;
        existingStemKeys.add(key);
        return true;
      });
      const merged = [...state.questions, ...appended];
      return {
        questions: merged,
        targetCount: Math.max(merged.length, meta?.targetCount ?? state.targetCount),
        modelUsed: meta?.modelUsed || state.modelUsed,
        qualityGatePassed: meta?.qualityGatePassed ?? state.qualityGatePassed,
        qualityScore: meta?.qualityScore ?? state.qualityScore,
      };
    });
  },

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

  resumeQuiz: () =>
    set((state) => {
      const nextIndex = state.questions.findIndex((q) => !state.answers.has(q.id));
      return {
        phase: "quiz",
        currentIndex:
          nextIndex >= 0
            ? nextIndex
            : Math.max(0, Math.min(state.currentIndex, state.questions.length - 1)),
      };
    }),

  setBackfillStatus: (status, error = null) =>
    set({
      backfillStatus: status,
      backfillError: error,
    }),

  setError: (msg) => set({ phase: "setup", error: msg, backfillError: null }),

  reset: () =>
    set({
      phase: "setup",
      topic: "",
      level: "MD3",
      levelLabel: "",
      targetCount: 0,
      questions: [],
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      modelUsed: "",
      qualityGatePassed: undefined,
      qualityScore: undefined,
      backgroundJobId: null,
      backfillStatus: "idle",
      backfillError: null,
      error: null,
    }),
}));
