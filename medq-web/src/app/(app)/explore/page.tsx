"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Loader2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useExploreStore } from "@/lib/stores/explore-store";
import { ExploreResults } from "@/components/explore/explore-results";
import * as fn from "@/lib/firebase/functions";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

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

export default function ExplorePage() {
  const { uid } = useAuth();
  const store = useExploreStore();
  const {
    phase,
    questions,
    currentIndex,
    answers,
    results,
    error,
    topic,
    levelLabel,
    targetCount,
    backgroundJobId,
    backfillStatus,
    backfillError,
    qualityGatePassed,
    qualityScore,
  } = store;
  const syncBackgroundQuestions = store.syncBackgroundQuestions;
  const setBackfillStatus = store.setBackfillStatus;
  const syncedCountRef = useRef(0);
  const terminalStatusRef = useRef<string | null>(null);

  const [inputTopic, setInputTopic] = useState("");
  const [inputLevel, setInputLevel] = useState("MD3");
  const [inputCount, setInputCount] = useState(10);

  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer =
    currentQuestion != null ? answers.get(currentQuestion.id) : undefined;
  const isAnswered = currentAnswer !== undefined;
  const isAdvancedLevel = ADVANCED_LEVEL_IDS.has(store.level || inputLevel);
  const answeredCount = answers.size;
  const progressPercent =
    questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const isLastLoadedQuestion = currentIndex >= questions.length - 1;
  const waitingForMoreQuestions =
    backfillStatus === "running" && questions.length < targetCount;

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

  async function handleGenerate() {
    const trimmed = inputTopic.trim();
    if (!trimmed) {
      toast.error("Please enter a medical topic.");
      return;
    }
    store.startLoading(trimmed, inputLevel);
    try {
      const result = await fn.exploreQuiz({
        topic: trimmed,
        level: inputLevel,
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
      if (result.backgroundQueued && (result.remainingCount ?? 0) > 0) {
        toast.message(
          `${result.questions.length} question${result.questions.length === 1 ? "" : "s"} ready now. Generating ${result.remainingCount} more in background.`
        );
      }
    } catch (err) {
      store.setError(
        err instanceof Error ? err.message : "Failed to generate questions."
      );
    }
  }

  function handleSelectAnswer(optionIndex: number) {
    if (!currentQuestion || isAnswered) return;
    store.answerQuestion(currentQuestion.id, optionIndex);
  }

  function handleNext() {
    if (isLastLoadedQuestion) {
      store.finishQuiz();
    } else {
      store.nextQuestion();
    }
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="page-wrap page-stack">
        <div className="glass-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Compass className="h-6 w-6 text-primary" />
            <div>
              <h1 className="page-title">Explore</h1>
              <p className="page-subtitle">
                Quiz yourself on any medical topic. AI generates questions on
                the fly.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Choose Your Topic</CardTitle>
            <CardDescription>
              Type any medical topic and select your level to begin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Topic</span>
              <input
                type="text"
                value={inputTopic}
                onChange={(e) => setInputTopic(e.target.value)}
                placeholder="e.g. Cardiac Arrhythmias, Renal Physiology, Pharmacokinetics..."
                maxLength={200}
                className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary/35"
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Level</span>
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
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
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
              </label>
            </div>

            <Button onClick={handleGenerate} disabled={!inputTopic.trim()}>
              Generate Quiz
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="page-wrap flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Preparing your first questions on &ldquo;{store.topic || inputTopic}
          &rdquo;...
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isAdvancedLevel
            ? "Advanced levels start in seconds; remaining questions continue in background."
            : "Initial questions usually load in under 20 seconds."}
        </p>
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (phase === "results") {
    return (
      <div className="page-wrap page-stack">
        <ExploreResults />
      </div>
    );
  }

  // ── QUIZ ───────────────────────────────────────────────────────────────
  if (!currentQuestion) return null;

  return (
    <div className="page-wrap page-stack">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{topic}</Badge>
            <Badge variant="outline">{levelLabel}</Badge>
            <Badge variant="outline">
              {currentIndex + 1}/{questions.length}
            </Badge>
            <Badge variant="outline">
              Answered {answeredCount}/{questions.length}
            </Badge>
            {targetCount > questions.length && (
              <Badge variant="outline">
                Target {questions.length}/{targetCount}
              </Badge>
            )}
            {backfillStatus === "running" && (
              <Badge variant="outline">Generating more...</Badge>
            )}
            {typeof qualityScore === "number" && (
              <Badge variant={qualityGatePassed ? "secondary" : "outline"}>
                Quality {Math.round(qualityScore * 100)}%
              </Badge>
            )}
          </div>
          <Progress value={progressPercent} className="h-2.5" />
          {backfillError && (
            <p className="text-xs text-destructive">{backfillError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed">
            {currentQuestion.stem}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

          {isAnswered && (
            <div className="space-y-3 pt-2">
              <div
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  results.get(currentQuestion.id)
                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                }`}
              >
                {results.get(currentQuestion.id)
                  ? "Correct!"
                  : `Incorrect. Answer: ${String.fromCharCode(65 + currentQuestion.correctIndex)}`}
              </div>

              {currentQuestion.explanation?.keyTakeaway && (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Key takeaway
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentQuestion.explanation.keyTakeaway}
                  </p>
                </div>
              )}

              {currentQuestion.explanation?.correctWhy && (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                    Why correct
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentQuestion.explanation.correctWhy}
                  </p>
                </div>
              )}

              {(currentQuestion.citations?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Verified sources
                  </p>
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

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleNext}>
                  {isLastLoadedQuestion
                    ? waitingForMoreQuestions
                      ? "Finish For Now"
                      : "See Results"
                    : "Next Question"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!isLastLoadedQuestion && (
                  <Button
                    variant="outline"
                    onClick={() => store.finishQuiz()}
                  >
                    End Now
                  </Button>
                )}
              </div>
              {waitingForMoreQuestions && (
                <p className="text-xs text-muted-foreground">
                  Generating {targetCount - questions.length} more questions in the
                  background. You can finish now or wait for more.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
