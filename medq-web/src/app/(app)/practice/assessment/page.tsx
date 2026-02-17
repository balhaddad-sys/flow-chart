"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  Loader2,
  RotateCcw,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import * as fn from "@/lib/firebase/functions";
import type {
  AssessmentLevel,
  AssessmentQuestion,
  AssessmentReport,
  AssessmentTopic,
} from "@/lib/firebase/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NumberTicker } from "@/components/ui/animate-in";
import { toast } from "sonner";

interface AnswerState {
  answerIndex: number;
  correct: boolean;
  correctIndex: number;
  explanation?: {
    correctWhy?: string;
    whyOthersWrong?: string[];
    keyTakeaway?: string;
  } | null;
}

function severityBadge(severity: string) {
  if (severity === "CRITICAL") {
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">Critical</Badge>;
  }
  if (severity === "REINFORCE") {
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Reinforce</Badge>;
  }
  return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Strong</Badge>;
}

function confidenceLabel(value: number) {
  if (value <= 2) return "Low";
  if (value === 3) return "Medium";
  return "High";
}

export default function AssessmentPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { courses } = useCourses();
  const activeCourse = courses.find((course) => course.id === courseId);

  const [topics, setTopics] = useState<AssessmentTopic[]>([]);
  const [levels, setLevels] = useState<AssessmentLevel[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("MD3");
  const [questionCount, setQuestionCount] = useState(15);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLevelLabel, setSessionLevelLabel] = useState("");
  const [targetTimeSec, setTargetTimeSec] = useState(70);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStartMs, setQuestionStartMs] = useState<number>(Date.now());
  const [currentConfidence, setCurrentConfidence] = useState(3);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [report, setReport] = useState<AssessmentReport | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let mounted = true;
    setCatalogLoading(true);
    setCatalogError(null);

    fn.getAssessmentCatalog({ courseId })
      .then((result) => {
        if (!mounted) return;
        setTopics(result.topics || []);
        setLevels(result.levels || []);
        setSelectedLevel(result.defaultLevel || "MD3");

        const preferredTopic =
          result.topics.find((topic) => topic.availableQuestions >= 5)?.id ||
          result.topics[0]?.id ||
          "";
        setSelectedTopic(preferredTopic);
      })
      .catch((error) => {
        if (!mounted) return;
        setCatalogError(error instanceof Error ? error.message : "Failed to load assessment catalog.");
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [courseId]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const canStart = !!courseId && !!selectedTopic && !!selectedLevel && !starting;
  const topWeakTopic = report?.recommendations?.priorityTopics?.[0];

  async function handleStartAssessment() {
    if (!canStart || !courseId) return;
    setStarting(true);
    setRuntimeError(null);
    setReport(null);
    try {
      const result = await fn.startAssessmentSession({
        courseId,
        topicTag: selectedTopic,
        level: selectedLevel,
        questionCount,
      });
      setSessionId(result.sessionId);
      setQuestions(result.questions || []);
      setSessionLevelLabel(result.levelLabel || result.level);
      setTargetTimeSec(result.targetTimeSec || 70);
      setCurrentIndex(0);
      setQuestionStartMs(Date.now());
      setCurrentConfidence(3);
      setAnswers({});
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to start assessment.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSelectAnswer(optionIndex: number) {
    if (!sessionId || !currentQuestion || submitting || currentAnswer) return;
    setSubmitting(true);
    setRuntimeError(null);

    try {
      const elapsedSec = Math.min(3600, Math.max(0, Math.round((Date.now() - questionStartMs) / 1000)));
      const result = await fn.submitAssessmentAnswer({
        sessionId,
        questionId: currentQuestion.id,
        answerIndex: optionIndex,
        timeSpentSec: elapsedSec,
        confidence: currentConfidence,
      });

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          answerIndex: optionIndex,
          correct: result.correct,
          correctIndex: result.correctIndex,
          explanation: result.explanation,
        },
      }));

      if (result.isComplete) {
        await handleFinishAssessment(sessionId);
      }
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinishAssessment(activeSessionId?: string) {
    const targetSession = activeSessionId || sessionId;
    if (!targetSession) return;
    setFinishing(true);
    setRuntimeError(null);

    try {
      const result = await fn.finishAssessmentSession({ sessionId: targetSession });
      setReport(result);
      toast.success("Assessment report generated.");
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Failed to generate report.");
    } finally {
      setFinishing(false);
    }
  }

  function handleNextQuestion() {
    if (!currentQuestion || !currentAnswer) return;
    if (currentIndex >= questions.length - 1) {
      void handleFinishAssessment();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setQuestionStartMs(Date.now());
    setCurrentConfidence(3);
  }

  function handleRestart() {
    setSessionId(null);
    setQuestions([]);
    setCurrentIndex(0);
    setQuestionStartMs(Date.now());
    setCurrentConfidence(3);
    setAnswers({});
    setRuntimeError(null);
    setReport(null);
    setFinishing(false);
    setSubmitting(false);
  }

  if (!courseId) {
    return (
      <div className="page-wrap page-stack">
        <EmptyState
          icon={BrainCircuit}
          title="No course selected"
          description="Select or create a course to run adaptive topic assessments."
          action={{ label: "Create Course", href: "/onboarding" }}
        />
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title animate-in-up stagger-1">Adaptive Assessment</h1>
            <p className="page-subtitle animate-in-up stagger-2">
              Topic-focused diagnostics with level-based scoring and weakness intelligence.
            </p>
          </div>
          <Badge variant="secondary">
            {activeCourse ? activeCourse.title : "Active course"}
          </Badge>
        </div>
      </div>

      {runtimeError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {runtimeError}
        </div>
      )}

      {!report && !sessionId && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment Setup</CardTitle>
            <CardDescription>
              Choose your target topic and medical level before starting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {catalogLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading assessment catalog...
              </div>
            ) : catalogError ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                {catalogError}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Topic</span>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary/35"
                    >
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.label} ({topic.availableQuestions})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Level</span>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary/35"
                    >
                      {levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Question count</span>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-muted-foreground">{questionCount} questions</p>
                </label>

                {selectedTopic && (
                  <div className="rounded-xl border border-border/70 bg-muted/35 p-3 text-xs text-muted-foreground">
                    {topics.find((topic) => topic.id === selectedTopic)?.description}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleStartAssessment} disabled={!canStart}>
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Assessment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <Link href="/practice">
                <Button variant="outline">Back to Practice</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!report && sessionId && currentQuestion && (
        <>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{sessionLevelLabel || selectedLevel}</Badge>
                <Badge variant="outline">{selectedTopic}</Badge>
                <Badge variant="outline">
                  {currentIndex + 1}/{questions.length}
                </Badge>
              </div>
              <Progress value={progress} className="h-2.5" />
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  {answeredCount} answered
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Target {targetTimeSec}s/question
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg leading-relaxed">{currentQuestion.stem}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => !currentAnswer && setCurrentConfidence(value)}
                    disabled={!!currentAnswer}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      currentConfidence === value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/70 bg-background/70"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">{confidenceLabel(currentConfidence)}</span>
              </div>

              {currentQuestion.options.map((option, optionIndex) => {
                const selected = currentAnswer?.answerIndex === optionIndex;
                const isCorrectOption = currentAnswer?.correctIndex === optionIndex;
                let style = "border-border/70 bg-background/75 hover:bg-accent/45";

                if (currentAnswer) {
                  if (isCorrectOption) style = "border-green-500/60 bg-green-500/10";
                  else if (selected) style = "border-red-500/60 bg-red-500/10";
                  else style = "border-border/70 opacity-70";
                }

                return (
                  <button
                    key={optionIndex}
                    onClick={() => void handleSelectAnswer(optionIndex)}
                    disabled={!!currentAnswer || submitting}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${style}`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="flex-1 break-words">{option}</span>
                    {currentAnswer && isCorrectOption && (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    )}
                    {currentAnswer && selected && !currentAnswer.correct && (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}
                  </button>
                );
              })}

              {submitting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting answer...
                </div>
              )}

              {currentAnswer && (
                <div className="space-y-3 pt-2">
                  <div
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      currentAnswer.correct
                        ? "bg-green-500/10 text-green-700 dark:text-green-300"
                        : "bg-red-500/10 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {currentAnswer.correct
                      ? "Correct answer."
                      : `Incorrect. Correct option: ${String.fromCharCode(65 + currentAnswer.correctIndex)}.`}
                  </div>
                  {currentAnswer.explanation?.keyTakeaway && (
                    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Key takeaway</p>
                      <p className="mt-1 text-sm text-muted-foreground">{currentAnswer.explanation.keyTakeaway}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleNextQuestion} disabled={finishing}>
                      {currentIndex >= questions.length - 1 ? "Finish Assessment" : "Next Question"}
                      {currentIndex < questions.length - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleFinishAssessment()}
                      disabled={finishing}
                    >
                      {finishing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Finishing...
                        </>
                      ) : (
                        "End Now"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {report && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Assessment Report</CardTitle>
              <CardDescription>{report.recommendations.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/70 p-4 flex items-center gap-3">
                  <ProgressRing value={report.readinessScore} size={48} strokeWidth={4} color="oklch(0.65 0.20 260)" />
                  <div>
                    <p className="text-xs text-muted-foreground">Readiness</p>
                    <p className="text-xl font-bold tabular-nums"><NumberTicker value={report.readinessScore} />%</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 p-4 flex items-center gap-3">
                  <ProgressRing value={report.overallAccuracy} size={48} strokeWidth={4} color="oklch(0.70 0.18 155)" />
                  <div>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                    <p className="text-xl font-bold tabular-nums"><NumberTicker value={report.overallAccuracy} />%</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{report.answeredCount}/{report.totalQuestions} answered</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <p className="text-xs text-muted-foreground">Pace</p>
                  <p className="mt-1 text-xl font-bold tabular-nums"><NumberTicker value={report.avgTimeSec} />s</p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    Target {report.targetTimeSec}s per item
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70">
                <div className="grid grid-cols-[1.7fr_1fr_1fr_auto] gap-2 border-b border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Topic</span>
                  <span>Accuracy</span>
                  <span>Weakness</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border/60">
                  {report.weaknessProfile.map((topic) => (
                    <div
                      key={topic.tag}
                      className="grid grid-cols-[1.7fr_1fr_1fr_auto] items-center gap-2 px-3 py-2.5 text-sm"
                    >
                      <span className="break-words font-medium">{topic.tag}</span>
                      <span>{topic.accuracy}%</span>
                      <span>{topic.weaknessScore}</span>
                      <span>{severityBadge(topic.severity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommended Recovery Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.recommendations.actions.map((action, index) => (
                <div key={`${action.focusTag}_${index}`} className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{action.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{action.rationale}</p>
                    </div>
                    <Badge variant="outline">
                      <Clock3 className="mr-1 h-3 w-3" />
                      {action.recommendedMinutes} min
                    </Badge>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {action.drills.map((drill, i) => (
                      <li key={i} className="break-words">
                        {drill}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Exam execution tips
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {report.recommendations.examTips.map((tip, i) => (
                    <li key={i} className="inline-flex items-start gap-2">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                {topWeakTopic && (
                  <Link href={`/practice/quiz?mode=topic&topic=${encodeURIComponent(topWeakTopic)}`}>
                    <Button variant="outline">
                      <Target className="mr-2 h-4 w-4" />
                      Quiz Weakest Topic
                    </Button>
                  </Link>
                )}
                <Link href="/today/plan">
                  <Button variant="outline">
                    <Gauge className="mr-2 h-4 w-4" />
                    Open Planner
                  </Button>
                </Link>
                <Button onClick={handleRestart}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  New Assessment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!catalogLoading && !catalogError && topics.length === 0 && !sessionId && (
        <EmptyState
          icon={AlertCircle}
          title="No topics available"
          description="Generate quiz questions from Practice first, then run adaptive assessments."
          action={{ label: "Go to Practice", href: "/practice" }}
        />
      )}
    </div>
  );
}
