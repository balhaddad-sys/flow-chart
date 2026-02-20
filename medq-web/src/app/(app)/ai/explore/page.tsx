"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoadingState } from "@/components/ui/loading-state";
import { useExploreStore } from "@/lib/stores/explore-store";
import { ExploreResults } from "@/components/explore/explore-results";
import { ExploreTeaching } from "@/components/explore/explore-teaching";
import { ExploreAskAiWidget } from "@/components/explore/explore-ask-ai-widget";
import * as fn from "@/lib/firebase/functions";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import {
  getExploreHistory,
  addExploreHistoryEntry,
  removeExploreHistoryEntry,
  savePendingSession,
  updatePendingSession,
  getPendingSession,
  clearPendingSession,
  type ExploreHistoryEntry,
} from "@/lib/utils/explore-history";

const EXPLORE_LEVELS = [
  { id: "MD1", label: "MD1 (Foundations)" },
  { id: "MD2", label: "MD2 (Integrated Basics)" },
  { id: "MD3", label: "MD3 (Clinical Core)" },
  { id: "MD4", label: "MD4 (Advanced Clinical)" },
  { id: "MD5", label: "MD5 (Senior Clinical)" },
  { id: "INTERN", label: "Doctor Intern" },
  { id: "RESIDENT", label: "Resident" },
  { id: "POSTGRADUATE", label: "Doctor Postgraduate" },
];
const ADVANCED_LEVEL_IDS = new Set(["MD4", "MD5", "INTERN", "RESIDENT", "POSTGRADUATE"]);
const EXPLORE_SETUP_KEY = "medq_explore_setup_v2";
const TOPIC_SUGGESTIONS = [
  "Acute Coronary Syndrome",
  "DKA Management",
  "COPD Exacerbation",
  "Sepsis Protocol",
  "Atrial Fibrillation",
  "Nephrotic Syndrome",
];

function confidenceLabel(confidence: number | null | undefined) {
  const safe = Number(confidence || 0);
  if (safe >= 4) return "High confidence";
  if (safe >= 3) return "Moderate confidence";
  if (safe >= 1) return "Low confidence";
  return "Not set";
}

function buildCalibrationFeedback({
  confidence,
  isCorrect,
}: {
  confidence: number | null | undefined;
  isCorrect: boolean;
}) {
  const safe = Number(confidence || 0);
  if (safe >= 4 && !isCorrect) {
    return {
      title: "Overconfident miss",
      message: "You were very confident but missed this. Identify the single clinical clue you over-weighted.",
      toneClass: "text-amber-600 dark:text-amber-400",
    };
  }
  if (safe <= 2 && isCorrect) {
    return {
      title: "Underconfident correct",
      message: "Your reasoning was right. Trust your diagnostic process when similar clues appear again.",
      toneClass: "text-blue-600 dark:text-blue-400",
    };
  }
  if (safe >= 4 && isCorrect) {
    return {
      title: "Well-calibrated correct",
      message: "Strong confidence and correct answer. Keep this reasoning template for similar scenarios.",
      toneClass: "text-green-600 dark:text-green-400",
    };
  }
  return {
    title: "Calibration check",
    message: "Before moving on, restate the decisive clue and compare it with your confidence level.",
    toneClass: "text-muted-foreground",
  };
}

function evidenceBadgeVariant(evidenceQuality: string | undefined) {
  const q = String(evidenceQuality || "").toUpperCase();
  if (q === "HIGH") return "secondary" as const;
  return "outline" as const;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function levelShortLabel(level: string): string {
  const found = EXPLORE_LEVELS.find((l) => l.id === level);
  if (!found) return level;
  if (level.startsWith("MD")) return level;
  return level.slice(0, 3).toUpperCase();
}

export default function ExplorePage() {
  const { uid } = useAuth();
  const store = useExploreStore();
  const {
    phase,
    questions,
    currentIndex,
    answers,
    confidence,
    results,
    error,
    topic,
    targetCount,
    backgroundJobId,
    backfillStatus,
    backfillError,
  } = store;
  const syncBackgroundQuestions = store.syncBackgroundQuestions;
  const setBackfillStatus = store.setBackfillStatus;
  const setConfidence = store.setConfidence;
  const syncedCountRef = useRef(0);
  const terminalStatusRef = useRef<string | null>(null);

  // Wait for Zustand persist to rehydrate from localStorage
  const [hydrated, setHydrated] = useState(useExploreStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useExploreStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  const [inputTopic, setInputTopic] = useState("");
  const [inputLevel, setInputLevel] = useState("MD3");
  const [inputCount, setInputCount] = useState(10);
  const [inputIntent, setInputIntent] = useState<"quiz" | "learn">("quiz");
  const [history, setHistory] = useState<ExploreHistoryEntry[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const refreshHistory = useCallback(() => setHistory(getExploreHistory()), []);

  useEffect(() => {
    refreshHistory();
    try {
      const raw = window.localStorage.getItem(EXPLORE_SETUP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        topic?: unknown;
        level?: unknown;
        count?: unknown;
        intent?: unknown;
      };

      if (typeof parsed.topic === "string") {
        setInputTopic(parsed.topic.slice(0, 200));
      }
      if (
        typeof parsed.level === "string" &&
        EXPLORE_LEVELS.some((lvl) => lvl.id === parsed.level)
      ) {
        setInputLevel(parsed.level);
      }
      if (typeof parsed.count === "number" && Number.isFinite(parsed.count)) {
        setInputCount(Math.max(3, Math.min(20, Math.floor(parsed.count))));
      }
      if (parsed.intent === "learn" || parsed.intent === "quiz") {
        setInputIntent(parsed.intent);
      }
    } catch {
      // Ignore localStorage parse errors.
    }
  }, [refreshHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPLORE_SETUP_KEY,
        JSON.stringify({
          topic: inputTopic,
          level: inputLevel,
          count: inputCount,
          intent: inputIntent,
        })
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [inputTopic, inputLevel, inputCount, inputIntent]);

  // ── Auto-resume pending session if user navigated away mid-generation ──
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || resumedRef.current || phase !== "setup") return;
    const pending = getPendingSession();
    if (!pending) return;
    resumedRef.current = true;
    toast("Resuming your last session...", { duration: 3000 });
    setInputTopic(pending.topic);
    setInputLevel(pending.level);
    setInputIntent(pending.path);
    if (pending.count) setInputCount(pending.count);

    // Use setTimeout to let state settle before triggering
    setTimeout(() => {
      if (pending.path === "learn") {
        handleLearnTopic(pending.topic, pending.level);
      } else {
        handleStartQuiz(pending.topic, pending.level, pending.count);
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hydrated]);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer =
    currentQuestion != null ? answers.get(currentQuestion.id) : undefined;
  const currentConfidence =
    currentQuestion != null ? confidence.get(currentQuestion.id) : undefined;
  const isAnswered = currentAnswer !== undefined;
  const isAdvancedLevel = ADVANCED_LEVEL_IDS.has(store.level || inputLevel);
  const answeredCount = answers.size;
  const progressPercent =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const isLastLoadedQuestion = currentIndex >= questions.length - 1;
  const waitingForMoreQuestions =
    backfillStatus === "running" && questions.length < targetCount;
  const optionReasoning = currentQuestion?.explanation?.whyOthersWrong ?? [];
  const selectedOptionReason =
    isAnswered && currentAnswer != null
      ? optionReasoning[currentAnswer] || ""
      : "";
  const isCurrentCorrect =
    isAnswered && currentQuestion != null
      ? results.get(currentQuestion.id) === true
      : false;
  const calibrationFeedback = buildCalibrationFeedback({
    confidence: currentConfidence,
    isCorrect: isCurrentCorrect,
  });
  useEffect(() => {
    syncedCountRef.current = questions.length;
  }, [questions.length]);

  useEffect(() => {
    terminalStatusRef.current = null;
  }, [backgroundJobId]);

  useEffect(() => {
    if (!uid || !backgroundJobId || backfillStatus !== "running") return;

    const jobRef = doc(db, "users", uid, "jobs", backgroundJobId);
    const unsubscribe = onSnapshot(
      jobRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const status = String(data.status || "");
        const target = Number(data.targetCount || targetCount || 0);
        const jobQuestions = Array.isArray(data.questions)
          ? (data.questions as fn.ExploreQuestion[])
          : [];

        syncBackgroundQuestions(jobQuestions, {
          targetCount: target,
          modelUsed: String(data.modelUsed || ""),
          qualityGatePassed:
            typeof data.qualityGatePassed === "boolean"
              ? data.qualityGatePassed
              : undefined,
          qualityScore:
            typeof data.qualityScore === "number" ? data.qualityScore : undefined,
        });

        if (jobQuestions.length > syncedCountRef.current) {
          const added = jobQuestions.length - syncedCountRef.current;
          syncedCountRef.current = jobQuestions.length;
          toast.success(
            `${added} new question${added === 1 ? "" : "s"} added in background.`
          );
        }

        if (status === "COMPLETED" && terminalStatusRef.current !== "COMPLETED") {
          terminalStatusRef.current = "COMPLETED";
          setBackfillStatus("completed", null);
          clearPendingSession();
          const remaining = Number(data.remainingCount || 0);
          if (remaining > 0) {
            toast.message(
              `Background generation finished with ${jobQuestions.length}/${target} questions.`
            );
          } else {
            toast.success("All requested Explore questions are ready.");
          }
        } else if (status === "FAILED" && terminalStatusRef.current !== "FAILED") {
          terminalStatusRef.current = "FAILED";
          clearPendingSession();
          const message = String(
            data.error || "Background generation failed. You can still continue with ready questions."
          );
          setBackfillStatus("failed", message);
          toast.error(message);
        }
      },
      (snapshotError) => {
        if (terminalStatusRef.current === "FAILED") return;
        terminalStatusRef.current = "FAILED";
        setBackfillStatus("failed", snapshotError.message);
        toast.error("Lost connection to background generation updates.");
      }
    );

    return unsubscribe;
  }, [
    uid,
    backgroundJobId,
    backfillStatus,
    setBackfillStatus,
    syncBackgroundQuestions,
    targetCount,
  ]);

  async function handleLearnTopic(overrideTopic?: string, overrideLevel?: string) {
    const trimmed = (overrideTopic ?? inputTopic).trim();
    const level = overrideLevel ?? inputLevel;
    if (!trimmed) {
      toast.error("Please enter a medical topic.");
      return;
    }
    store.setUserPath("learn");
    store.startLoading(trimmed, level);
    savePendingSession({ topic: trimmed, level, path: "learn" });
    try {
      const insight = await fn.exploreTopicInsight({
        topic: trimmed,
        level,
      });
      store.setTopicInsight(insight);
      store.startTeaching(insight);
      clearPendingSession();
      const lvl = EXPLORE_LEVELS.find((l) => l.id === level);
      addExploreHistoryEntry({
        topic: trimmed,
        level,
        levelLabel: lvl?.label ?? level,
        path: "learn",
      });
      refreshHistory();
    } catch (err) {
      clearPendingSession();
      store.setLoadingError(
        err instanceof Error ? err.message : "Failed to generate teaching content."
      );
    }
  }

  async function handleStartQuiz(overrideTopic?: string, overrideLevel?: string, overrideCount?: number) {
    const trimmed = (overrideTopic ?? inputTopic).trim();
    const level = overrideLevel ?? inputLevel;
    const count = overrideCount ?? inputCount;
    if (!trimmed) {
      toast.error("Please enter a medical topic.");
      return;
    }
    store.setUserPath("quiz");
    store.startLoading(trimmed, level);
    savePendingSession({ topic: trimmed, level, path: "quiz", count });
    // Fetch insight silently in background for "Learn more" links
    fn.exploreTopicInsight({ topic: trimmed, level })
      .then((insight) => store.setTopicInsight(insight))
      .catch(() => {});
    try {
      const result = await fn.exploreQuiz({
        topic: trimmed,
        level,
        count,
      });
      store.startQuiz(
        result.questions,
        result.topic,
        result.level,
        result.levelLabel,
        {
          targetCount: result.targetCount ?? result.questions.length,
          backgroundJobId: result.backgroundJobId ?? null,
          backfillStatus: result.backgroundQueued ? "running" : "completed",
          modelUsed: result.modelUsed,
          qualityGatePassed: result.qualityGatePassed,
          qualityScore: result.qualityScore,
        }
      );
      // Keep session alive if background job is running, otherwise clear
      if (result.backgroundQueued && result.backgroundJobId) {
        updatePendingSession({ backgroundJobId: result.backgroundJobId });
      } else {
        clearPendingSession();
      }
      const lvl = EXPLORE_LEVELS.find((l) => l.id === level);
      addExploreHistoryEntry({
        topic: trimmed,
        level,
        levelLabel: lvl?.label ?? level,
        path: "quiz",
      });
      refreshHistory();
      if (result.backgroundQueued && (result.remainingCount ?? 0) > 0) {
        toast.message(
          `${result.questions.length} question${result.questions.length === 1 ? "" : "s"} ready now. Generating ${result.remainingCount} more in background.`
        );
      }
    } catch (err) {
      clearPendingSession();
      store.setLoadingError(
        err instanceof Error ? err.message : "Failed to generate questions."
      );
    }
  }

  /**
   * Instantly restore a previous session if the store already holds matching
   * data for this topic+level. Falls back to a fresh API fetch otherwise.
   */
  function handleResumeSession(entry: ExploreHistoryEntry) {
    const storeTopic = store.topic.trim().toLowerCase();
    const entryTopic = entry.topic.trim().toLowerCase();
    const storeLevel = store.level.trim().toLowerCase();
    const entryLevel = entry.level.trim().toLowerCase();
    const matches = storeTopic === entryTopic && storeLevel === entryLevel;

    if (matches) {
      // Teaching content available → go straight to teaching
      if (entry.path === "learn" && store.topicInsight) {
        store.setUserPath("learn");
        store.startTeaching(store.topicInsight);
        return;
      }
      // Quiz questions available → resume quiz where they left off
      if (entry.path === "quiz" && store.questions.length > 0) {
        store.setUserPath("quiz");
        if (store.answers.size >= store.questions.length) {
          store.finishQuiz();
        } else {
          store.resumeQuiz();
        }
        return;
      }
    }

    // No matching cached data → fetch from API
    if (entry.path === "learn") {
      handleLearnTopic(entry.topic, entry.level);
    } else {
      handleStartQuiz(entry.topic, entry.level);
    }
  }

  function handleReset() {
    clearPendingSession();
    store.reset();
  }

  function handleRetry() {
    store.setLoadingError(null);
    if (store.userPath === "learn") {
      handleLearnTopic(store.topic, store.level);
    } else {
      handleStartQuiz(store.topic, store.level);
    }
  }

  async function handlePrimarySetupAction() {
    if (inputIntent === "learn") {
      await handleLearnTopic();
      return;
    }
    await handleStartQuiz();
  }

  async function handleQuizFromTeaching() {
    if (store.questions.length > 0) {
      store.goToQuizFromTeaching();
    } else {
      store.startLoading(store.topic, store.level);
      try {
        const result = await fn.exploreQuiz({
          topic: store.topic,
          level: store.level,
          count: inputCount,
        });
        store.startQuiz(
          result.questions,
          result.topic,
          result.level,
          result.levelLabel,
          {
            targetCount: result.targetCount ?? result.questions.length,
            backgroundJobId: result.backgroundJobId ?? null,
            backfillStatus: result.backgroundQueued ? "running" : "completed",
            modelUsed: result.modelUsed,
            qualityGatePassed: result.qualityGatePassed,
            qualityScore: result.qualityScore,
          }
        );
      } catch (err) {
        store.setLoadingError(
          err instanceof Error ? err.message : "Failed to generate questions."
        );
      }
    }
  }

  function handleSelectAnswer(optionIndex: number) {
    if (!currentQuestion || isAnswered) return;
    if (currentConfidence == null) {
      toast.message("Set your confidence first (low, moderate, or high).");
      return;
    }
    store.answerQuestion(currentQuestion.id, optionIndex, currentConfidence);
  }

  function handleNext() {
    if (isLastLoadedQuestion) {
      store.finishQuiz();
    } else {
      store.nextQuestion();
    }
  }

  // ── Wait for store hydration ──
  if (!hydrated) {
    return (
      <div className="page-wrap py-16">
        <PageLoadingState
          title="Restoring your session"
          description="Loading your previous explore progress..."
          minHeightClassName="min-h-[30dvh]"
        />
      </div>
    );
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="page-wrap page-stack">
        {/* Hero */}
        <div className="glass-card p-5 sm:p-6 animate-in-up">
          <h1 className="page-title text-balance">Explore any topic</h1>
          <p className="mt-1.5 page-subtitle max-w-md">
            Learn with structured teaching or test yourself with adaptive questions.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Topic input */}
        <div className="glass-card p-4 sm:p-5 animate-in-up stagger-1">
          <label className="block">
            <span className="text-sm font-medium">What do you want to study?</span>
            <input
              type="text"
              value={inputTopic}
              onChange={(e) => setInputTopic(e.target.value)}
              placeholder="e.g. Cardiac arrhythmias, renal physiology..."
              maxLength={200}
              className="mt-2 w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary/35"
              onKeyDown={(e) => e.key === "Enter" && handlePrimarySetupAction()}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TOPIC_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInputTopic(suggestion)}
                className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Recent topics */}
        {history.length > 0 && (
          <div className="glass-card p-4 sm:p-5 animate-in-up stagger-2">
            <p className="text-xs font-medium text-muted-foreground mb-2.5">Recent topics</p>
            <div className="space-y-1">
              {(showAllHistory ? history : history.slice(0, 6)).map((entry) => (
                <div
                  key={`${entry.topic}::${entry.level}`}
                  className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 -mx-1 transition-colors hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    setInputTopic(entry.topic);
                    setInputLevel(entry.level);
                    setInputIntent(entry.path);
                    handleResumeSession(entry);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setInputTopic(entry.topic);
                      setInputLevel(entry.level);
                      setInputIntent(entry.path);
                      handleResumeSession(entry);
                    }
                  }}
                >
                  {entry.path === "learn" ? (
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm">{entry.topic}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                    {levelShortLabel(entry.level)}
                  </Badge>
                  <span className="shrink-0 text-[10px] text-muted-foreground/70 w-14 text-right">
                    {relativeTime(entry.timestamp)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${entry.topic}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExploreHistoryEntry(entry.topic, entry.level);
                      refreshHistory();
                    }}
                    className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            {history.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((v) => !v)}
                className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {showAllHistory ? "Show less" : `Show all (${history.length})`}
              </button>
            )}
          </div>
        )}

        {/* Mode selection */}
        <div className={`grid grid-cols-2 gap-3 animate-in-up ${history.length > 0 ? "stagger-3" : "stagger-2"}`}>
          <button
            type="button"
            onClick={() => setInputIntent("learn")}
            aria-pressed={inputIntent === "learn"}
            className={`surface-interactive flex flex-col items-center gap-2 p-4 text-center transition-all ${
              inputIntent === "learn"
                ? "border-blue-500/60 ring-2 ring-blue-500/20"
                : ""
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              inputIntent === "learn" ? "bg-blue-500/15" : "bg-muted"
            }`}>
              <BookOpen className={`h-5 w-5 ${
                inputIntent === "learn" ? "text-blue-500" : "text-muted-foreground"
              }`} />
            </div>
            <div>
              <p className="text-sm font-semibold">Learn</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                Teaching first, then quiz
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInputIntent("quiz")}
            aria-pressed={inputIntent === "quiz"}
            className={`surface-interactive flex flex-col items-center gap-2 p-4 text-center transition-all ${
              inputIntent === "quiz"
                ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                : ""
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              inputIntent === "quiz" ? "bg-emerald-500/15" : "bg-muted"
            }`}>
              <Zap className={`h-5 w-5 ${
                inputIntent === "quiz" ? "text-emerald-500" : "text-muted-foreground"
              }`} />
            </div>
            <div>
              <p className="text-sm font-semibold">Quiz</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                Jump straight into questions
              </p>
            </div>
          </button>
        </div>

        {/* Settings */}
        <div className={`glass-card p-4 sm:p-5 animate-in-up ${history.length > 0 ? "stagger-4" : "stagger-3"}`}>
          <div className={`grid gap-4 ${inputIntent === "quiz" ? "grid-cols-2" : ""}`}>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Level</span>
              <select
                value={inputLevel}
                onChange={(e) => setInputLevel(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary/35"
              >
                {EXPLORE_LEVELS.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </label>

            {inputIntent === "quiz" && (
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Questions ({inputCount})
                </span>
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={inputCount}
                  onChange={(e) => setInputCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex flex-wrap gap-1">
                  {[5, 10, 15, 20].map((countPreset) => (
                    <button
                      key={countPreset}
                      type="button"
                      onClick={() => setInputCount(countPreset)}
                      className={`rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
                        inputCount === countPreset
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {countPreset}
                    </button>
                  ))}
                </div>
              </label>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className={`animate-in-up ${history.length > 0 ? "stagger-5" : "stagger-4"}`}>
          <Button
            onClick={handlePrimarySetupAction}
            disabled={!inputTopic.trim()}
            className="w-full sm:w-auto sm:min-w-48"
            size="lg"
          >
            {inputIntent === "learn" ? (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Start Learning
              </>
            ) : (
              <>
                Start Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    if (store.loadingError) {
      return (
        <div className="page-wrap flex flex-col items-center justify-center py-24">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">Something went wrong</p>
          <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
            {store.loadingError}
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              Back to Setup
            </Button>
            <Button onClick={handleRetry}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="page-wrap py-16">
        <PageLoadingState
          title={
            store.userPath === "learn"
              ? `Generating teaching content for "${store.topic || inputTopic}"`
              : `Preparing quiz questions for "${store.topic || inputTopic}"`
          }
          description={
            store.userPath === "learn"
              ? "Building structured teaching notes with clinical context and exam focus."
              : isAdvancedLevel
                ? "Advanced levels load in phases. Extra questions continue in the background."
                : "Initial questions usually load in under 20 seconds."
          }
          minHeightClassName="min-h-[45dvh]"
        />
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── TEACHING ───────────────────────────────────────────────────────────
  if (phase === "teaching") {
    return (
      <div className="page-wrap page-stack">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground -ml-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <ExploreTeaching
          onStartQuiz={handleQuizFromTeaching}
          onNewTopic={handleReset}
        />
        <ExploreAskAiWidget />
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (phase === "results") {
    return (
      <div className="page-wrap page-stack">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground -ml-1"
        >
          <ArrowLeft className="h-4 w-4" />
          New topic
        </button>
        <ExploreResults />
        <ExploreAskAiWidget />
      </div>
    );
  }

  // ── QUIZ ───────────────────────────────────────────────────────────────
  if (!currentQuestion) return null;

  return (
    <div className="page-wrap page-stack">
      <ExploreAskAiWidget />
      {/* Progress header */}
      <div className="glass-card p-4 animate-in-up">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              aria-label="Back to setup"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="min-w-0 truncate text-sm font-medium">{topic}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {backfillError && (
          <p className="mt-2 text-xs text-destructive">{backfillError}</p>
        )}
      </div>

      {/* Question card */}
      <div className="glass-card p-4 sm:p-5 animate-in-up stagger-1 space-y-4">
        <p className="text-base font-semibold leading-relaxed">
          {currentQuestion.stem}
        </p>

        {/* Confidence — inline row */}
        {!isAnswered ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">How confident?</span>
            {[
              { value: 1, label: "Low" },
              { value: 3, label: "Medium" },
              { value: 5, label: "High" },
            ].map((item) => {
              const isActive = currentConfidence === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setConfidence(currentQuestion.id, item.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Confidence: {confidenceLabel(currentConfidence)}
          </p>
        )}

        {/* Options */}
        {currentConfidence == null && !isAnswered && (
          <p className="text-xs text-muted-foreground/70">
            Set confidence to unlock options
          </p>
        )}
        <div className={`space-y-2 ${currentConfidence == null && !isAnswered ? "opacity-50 pointer-events-none" : ""}`}>
          {currentQuestion.options.map((option, idx) => {
            const selected = currentAnswer === idx;
            const isCorrectOption = currentQuestion.correctIndex === idx;
            let style = "border-border/70 bg-background/75 hover:bg-accent/45";

            if (isAnswered) {
              if (isCorrectOption)
                style = "border-green-500/60 bg-green-500/10";
              else if (selected) style = "border-red-500/60 bg-red-500/10";
              else style = "border-border/70 opacity-70";
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(idx)}
                disabled={isAnswered}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${style}`}
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 break-words">{option}</span>
                {isAnswered && isCorrectOption && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                )}
                {isAnswered && selected && !results.get(currentQuestion.id) && (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Post-answer */}
        {isAnswered && (
          <div className="space-y-3 pt-1">
            {/* Result banner + Next button */}
            <div
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                results.get(currentQuestion.id)
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              <span className="text-sm font-medium">
                {results.get(currentQuestion.id)
                  ? "Correct!"
                  : `Incorrect — ${String.fromCharCode(65 + currentQuestion.correctIndex)}`}
              </span>
              <Button size="sm" onClick={handleNext} className="shrink-0">
                {isLastLoadedQuestion
                  ? waitingForMoreQuestions
                    ? "Finish"
                    : "Results"
                  : "Next"}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Calibration — inline */}
            <p className={`text-xs ${calibrationFeedback.toneClass}`}>
              <span className="font-semibold">{calibrationFeedback.title}:</span>{" "}
              {calibrationFeedback.message}
            </p>

            {/* Key takeaway + Why correct — merged box */}
            {(currentQuestion.explanation?.keyTakeaway ||
              currentQuestion.explanation?.correctWhy) && (
              <div className="rounded-xl border border-border/70 bg-background/70 p-3 space-y-2">
                {currentQuestion.explanation?.keyTakeaway && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Key takeaway
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {currentQuestion.explanation.keyTakeaway}
                    </p>
                  </div>
                )}
                {currentQuestion.explanation?.correctWhy && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                      Why correct
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {currentQuestion.explanation.correctWhy}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Deep review accordion — includes sources + more actions */}
            {(selectedOptionReason ||
              optionReasoning.length > 0 ||
              (currentQuestion.citations?.length ?? 0) > 0 ||
              !isLastLoadedQuestion ||
              store.topicInsight) && (
              <details className="rounded-xl border border-border/70 bg-background/70 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deep review
                </summary>
                <div className="mt-3 space-y-3">
                  {selectedOptionReason && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Your selected option
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {selectedOptionReason}
                      </p>
                    </div>
                  )}

                  {optionReasoning.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Option-by-option reasoning
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {currentQuestion.options.map((option, optionIndex) => {
                          const reasoning = optionReasoning[optionIndex];
                          if (!reasoning) return null;
                          return (
                            <p
                              key={`${option}_${optionIndex}`}
                              className="text-sm text-muted-foreground"
                            >
                              {String.fromCharCode(65 + optionIndex)}. {reasoning}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(currentQuestion.citations?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Sources
                        </p>
                        <Badge variant={evidenceBadgeVariant(currentQuestion.citationMeta?.evidenceQuality)}>
                          {currentQuestion.citationMeta?.evidenceQuality || "MODERATE"}
                        </Badge>
                      </div>
                      {currentQuestion.citationMeta?.fallbackUsed && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          Verify the exact publication before relying clinically.
                        </p>
                      )}
                      <div className="mt-2 space-y-1.5">
                        {currentQuestion.citations?.slice(0, 3).map((citation, idx) => (
                          <a
                            key={`${citation.url}_${idx}`}
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 text-sm transition-colors hover:bg-accent/40"
                          >
                            <span className="font-medium text-primary">{citation.source}</span>
                            <span className="flex-1 text-muted-foreground">{citation.title}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions inside deep review */}
                  {(!isLastLoadedQuestion || store.topicInsight) && (
                    <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                      {!isLastLoadedQuestion && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => store.finishQuiz()}
                        >
                          End quiz
                        </Button>
                      )}
                      {store.topicInsight && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => store.goToTeachingFromQuiz()}
                        >
                          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                          Review teaching
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </details>
            )}

            {waitingForMoreQuestions && (
              <p className="text-xs text-muted-foreground">
                Generating {targetCount - questions.length} more in background.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
