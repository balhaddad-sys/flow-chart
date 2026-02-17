"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookText,
  CheckCircle2,
  Compass,
  Loader2,
  Sparkles,
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

function buildGuidelineTrendData(
  updates: fn.ExploreTopicInsightResult["guidelineUpdates"] | undefined
) {
  const yearlyMap = new Map<
    number,
    { year: number; updateCount: number; impactTotal: number }
  >();

  for (const update of updates || []) {
    if (typeof update.year !== "number") continue;
    const bucket = yearlyMap.get(update.year) || {
      year: update.year,
      updateCount: 0,
      impactTotal: 0,
    };
    bucket.updateCount += 1;
    bucket.impactTotal += Number(update.impactScore || 0);
    yearlyMap.set(update.year, bucket);
  }

  return Array.from(yearlyMap.values())
    .sort((a, b) => a.year - b.year)
    .map((item) => ({
      year: String(item.year),
      updates: item.updateCount,
      impact: Number((item.impactTotal / item.updateCount).toFixed(2)),
    }));
}

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
  const [topicInsight, setTopicInsight] = useState<fn.ExploreTopicInsightResult | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insightKey, setInsightKey] = useState("");

  const setupInsightKey = `${inputTopic.trim().toLowerCase()}::${inputLevel}`;
  const quizInsightKey = `${topic.trim().toLowerCase()}::${store.level}`;
  const setupInsight = topicInsight && insightKey === setupInsightKey ? topicInsight : null;
  const quizInsight = topicInsight && insightKey === quizInsightKey ? topicInsight : null;

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
  const optionReasoning = currentQuestion?.explanation?.whyOthersWrong ?? [];
  const selectedOptionReason =
    isAnswered && currentAnswer != null
      ? optionReasoning[currentAnswer] || ""
      : "";
  const guidelineTrendData = buildGuidelineTrendData(quizInsight?.guidelineUpdates);
  const latestGuidelineUpdates = (quizInsight?.guidelineUpdates || []).slice(0, 5);

  async function loadTopicInsight(
    topicValue: string,
    levelValue: string,
    opts: { force?: boolean; notifyError?: boolean } = {}
  ) {
    const { force = false, notifyError = false } = opts;
    const trimmed = topicValue.trim();
    if (!trimmed) return;

    const key = `${trimmed.toLowerCase()}::${levelValue}`;
    if (!force && insightLoading) return;
    if (!force && topicInsight && insightKey === key) return;

    setInsightLoading(true);
    setInsightError(null);
    try {
      const insight = await fn.exploreTopicInsight({
        topic: trimmed,
        level: levelValue,
      });
      setTopicInsight(insight);
      setInsightKey(key);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate topic briefing.";
      setInsightError(message);
      if (notifyError) {
        toast.error(message);
      }
    } finally {
      setInsightLoading(false);
    }
  }

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
    void loadTopicInsight(trimmed, inputLevel, {
      force: false,
      notifyError: false,
    });
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

  async function handleGenerateInsight() {
    const trimmed = inputTopic.trim();
    if (!trimmed) {
      toast.error("Please enter a medical topic.");
      return;
    }
    await loadTopicInsight(trimmed, inputLevel, {
      force: true,
      notifyError: true,
    });
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

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={!inputTopic.trim()}>
                Generate Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateInsight}
                disabled={!inputTopic.trim() || insightLoading}
              >
                {insightLoading ? "Generating..." : "Topic Brief"}
                {!insightLoading && <BookText className="ml-2 h-4 w-4" />}
              </Button>
            </div>

            {insightError && (
              <p className="text-xs text-destructive">{insightError}</p>
            )}

            {setupInsight && (
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Topic briefing
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {setupInsight.summary}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {setupInsight.corePoints.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Key points
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {setupInsight.corePoints.slice(0, 3).map((point, i) => (
                          <p
                            key={`${point}_${i}`}
                            className="text-xs text-muted-foreground"
                          >
                            {i + 1}. {point}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {(setupInsight.guidelineUpdates?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Recent guidelines
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {setupInsight.guidelineUpdates.slice(0, 3).map((update, i) => (
                          <p
                            key={`${update.title}_${i}`}
                            className="text-xs text-muted-foreground"
                          >
                            {update.year ? `${update.year} - ` : ""}{update.title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {(quizInsight || insightLoading || insightError) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Topic Brief</CardTitle>
            <CardDescription>
              High-yield context for {topic || "this topic"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!quizInsight && insightLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating topic brief...
              </div>
            )}
            {quizInsight && (
              <>
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Overview
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {quizInsight.summary}
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {quizInsight.corePoints.length > 0 && (
                    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Core points
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {quizInsight.corePoints.slice(0, 8).map((point, i) => (
                          <p
                            key={`${point}_${i}`}
                            className="text-sm text-muted-foreground"
                          >
                            {i + 1}. {point}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Clinical framework
                    </p>
                    {quizInsight.clinicalFramework?.pathophysiology && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Pathophysiology
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {quizInsight.clinicalFramework.pathophysiology}
                        </p>
                      </div>
                    )}
                    {(quizInsight.clinicalFramework?.diagnosticApproach?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Diagnostic approach
                        </p>
                        <div className="mt-1 space-y-1">
                          {quizInsight.clinicalFramework.diagnosticApproach.map((step, i) => (
                            <p key={`${step}_${i}`} className="text-sm text-muted-foreground">
                              {i + 1}. {step}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {(quizInsight.clinicalFramework?.managementApproach?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Management approach
                        </p>
                        <div className="mt-1 space-y-1">
                          {quizInsight.clinicalFramework.managementApproach.map((step, i) => (
                            <p key={`${step}_${i}`} className="text-sm text-muted-foreground">
                              {i + 1}. {step}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {(quizInsight.clinicalFramework?.escalationTriggers?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                          Escalation triggers
                        </p>
                        <div className="mt-1 space-y-1">
                          {quizInsight.clinicalFramework.escalationTriggers.map((step, i) => (
                            <p key={`${step}_${i}`} className="text-sm text-muted-foreground">
                              {i + 1}. {step}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(latestGuidelineUpdates.length > 0 || guidelineTrendData.length > 0) && (
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Recent guideline trend
                      </p>
                      <Badge variant="outline">
                        {latestGuidelineUpdates.length} updates
                      </Badge>
                    </div>

                    {guidelineTrendData.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3">
                        <div className="flex items-end gap-2 overflow-x-auto pb-1">
                          {guidelineTrendData.map((point) => (
                            <div
                              key={point.year}
                              className="min-w-[58px] flex-1 rounded-lg border border-border/50 bg-background/70 p-1.5"
                            >
                              <div className="flex h-24 items-end justify-center gap-1.5">
                                <div
                                  className="w-3 rounded-t bg-primary/80"
                                  style={{
                                    height: `${Math.max(10, Math.min(96, point.impact * 18))}px`,
                                  }}
                                  title={`Avg impact: ${point.impact}/5`}
                                />
                                <div
                                  className="w-3 rounded-t bg-muted-foreground/55"
                                  style={{
                                    height: `${Math.max(8, Math.min(96, point.updates * 20))}px`,
                                  }}
                                  title={`Updates: ${point.updates}`}
                                />
                              </div>
                              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                                {point.year}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-primary">Primary bar:</span>{" "}
                          average impact (1-5),{" "}
                          <span className="font-medium text-muted-foreground">
                            secondary bar:
                          </span>{" "}
                          number of updates.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Timeline points will appear when publication years are available.
                      </p>
                    )}

                    <div className="mt-3 space-y-2">
                      {latestGuidelineUpdates.map((update, i) => (
                        <a
                          key={`${update.title}_${i}`}
                          href={update.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group block rounded-lg border border-border/60 bg-background/70 p-2.5 transition-colors hover:bg-accent/40"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline">
                              {update.year ?? "Year n/a"}
                            </Badge>
                            <Badge variant="outline">{update.source}</Badge>
                            <Badge
                              variant={
                                update.strength === "HIGH" ? "secondary" : "outline"
                              }
                            >
                              {update.strength}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-sm font-medium">{update.title}</p>
                          {update.keyChange && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium">Key change: </span>
                              {update.keyChange}
                            </p>
                          )}
                          {update.practiceImpact && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-medium">Practice impact: </span>
                              {update.practiceImpact}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Open source</span>
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  {quizInsight.clinicalPitfalls.length > 0 && (
                    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Clinical pitfalls
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {quizInsight.clinicalPitfalls.map((item, i) => (
                          <p
                            key={`${item}_${i}`}
                            className="text-sm text-muted-foreground"
                          >
                            {i + 1}. {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {quizInsight.redFlags.length > 0 && (
                    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                        Red flags
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {quizInsight.redFlags.map((item, i) => (
                          <p
                            key={`${item}_${i}`}
                            className="text-sm text-muted-foreground"
                          >
                            {i + 1}. {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {quizInsight.studyApproach.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                      Study approach
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {quizInsight.studyApproach.map((item, i) => (
                        <p
                          key={`${item}_${i}`}
                          className="text-sm text-muted-foreground"
                        >
                          {i + 1}. {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {(quizInsight.citations?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Topic sources
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {quizInsight.citations?.slice(0, 6).map((citation, idx) => (
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
              </>
            )}
            {insightError && (
              <p className="text-xs text-destructive">{insightError}</p>
            )}
            <Button
              variant="outline"
              onClick={() =>
                loadTopicInsight(topic || inputTopic, store.level || inputLevel, {
                  force: true,
                  notifyError: true,
                })
              }
              disabled={insightLoading}
            >
              Refresh Brief
            </Button>
          </CardContent>
        </Card>
      )}

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

              {selectedOptionReason && (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Reasoning for your selected option
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedOptionReason}
                  </p>
                </div>
              )}

              {optionReasoning.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Option-by-option reasoning
                  </p>
                  <div className="mt-2 space-y-1.5">
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
