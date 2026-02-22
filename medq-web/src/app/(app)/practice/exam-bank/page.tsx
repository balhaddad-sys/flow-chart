"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import { useStats } from "@/lib/hooks/useStats";
import { useAuth } from "@/lib/hooks/useAuth";
import { useExamBank } from "@/lib/hooks/useExamBank";
import { useQuizStore } from "@/lib/stores/quiz-store";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { EXAM_CATALOG } from "@/lib/types/user";
import type { QuestionModel } from "@/lib/types/question";
import * as fn from "@/lib/firebase/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageLoadingState,
  LoadingButtonLabel,
  SectionLoadingState,
  InlineLoadingState,
} from "@/components/ui/loading-state";
import {
  ArrowLeft,
  Calendar,
  Zap,
  BookOpen,
  Target,
  Sparkles,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Timestamp as TSTimestamp } from "firebase/firestore";

// ── Exam metadata ─────────────────────────────────────────────────────────────

const EXAM_META: Record<
  string,
  { format: string; authority: string; focus: string; tip: string; color: string }
> = {
  SBA: {
    format: "Single Best Answer",
    authority: "General Medical",
    focus: "Core diagnosis, investigation logic, and first-line management",
    tip: "Use decisive clues in the stem and practice ruling out the strongest distractor.",
    color: "blue",
  },
  OSCE: {
    format: "Clinical stations",
    authority: "General Clinical",
    focus: "History, examination flow, communication, and safe escalation",
    tip: "Prioritize structure and safety first, then clinical depth and shared decisions.",
    color: "green",
  },
  PLAB1: {
    format: "180 SBAs · 3 hours",
    authority: "GMC UK",
    focus: "Clinical reasoning, UK guidelines, prescribing safety, GMC ethics",
    tip: "Anchor every answer to NICE guidelines and BNF drug choices. GMC ethics questions follow Good Medical Practice — know it.",
    color: "blue",
  },
  PLAB2: {
    format: "18 OSCE stations · ~3 hours",
    authority: "GMC UK",
    focus: "Clinical examination, communication, history taking, data interpretation",
    tip: "Use SOCRATES for pain, ICE for patient concerns, SBAR for handover. Every station has a hidden communication mark.",
    color: "blue",
  },
  MRCP_PART1: {
    format: "Best of Five · 200 questions",
    authority: "Royal Colleges UK",
    focus: "Mechanism-level medicine, rare presentations, investigation logic",
    tip: "Know the pathophysiology behind each drug — Best of Five rewards mechanism understanding, not pattern-matching.",
    color: "purple",
  },
  MRCP_PACES: {
    format: "5 clinical stations · 2 hours",
    authority: "Royal Colleges UK",
    focus: "Physical examination, history, communication, data interpretation, ethics",
    tip: "Communication station: use IDEAS framework. Examiners mark empathy and structure separately from medical content.",
    color: "purple",
  },
  MRCGP_AKT: {
    format: "200 MCQs · 3 hours",
    authority: "RCGP",
    focus: "Primary care, QOF, NNT, drug thresholds, referral pathways",
    tip: "Know QOF targets, QRISK thresholds, and when NOT to prescribe. Extended matching items (EMIs) need fast elimination.",
    color: "green",
  },
  USMLE_STEP1: {
    format: "280 questions · 8 hours",
    authority: "NBME",
    focus: "Basic science mechanisms, pathophysiology, pharmacology, microbiology",
    tip: "Every clinical vignette links to basic science. Always ask 'what is the underlying mechanism?' before choosing an answer.",
    color: "amber",
  },
  USMLE_STEP2: {
    format: "318 questions · 9 hours",
    authority: "NBME",
    focus: "Clinical management, AHA/ACC/USPSTF guidelines, next best step",
    tip: "NBME tests first-line management and 'next best step'. Know the algorithm, not just the drug.",
    color: "amber",
  },
  FINALS: {
    format: "SBA + OSCE · varies by university",
    authority: "University",
    focus: "Common presentations, prescribing, clinical communication, emergencies",
    tip: "Cover common things commonly. 80% of marks come from bread-and-butter medicine presented with subtle complexity.",
    color: "emerald",
  },
};

const EXAM_OPTIONS = EXAM_CATALOG.flatMap((group) => group.exams);
const EXAM_OPTION_KEYS = new Set(EXAM_OPTIONS.map((exam) => exam.key));

const COLOR_MAP: Record<
  string,
  { badge: string; icon: string; ring: string; bar: string; accent: string }
> = {
  blue: {
    badge: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
    icon: "bg-blue-500/15 text-blue-500",
    ring: "border-blue-500/30",
    bar: "from-blue-400 via-blue-500 to-sky-500",
    accent: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    badge: "bg-purple-500/12 text-purple-700 dark:text-purple-300",
    icon: "bg-purple-500/15 text-purple-500",
    ring: "border-purple-500/30",
    bar: "from-purple-400 via-purple-500 to-violet-500",
    accent: "text-purple-600 dark:text-purple-400",
  },
  green: {
    badge: "bg-green-500/12 text-green-700 dark:text-green-300",
    icon: "bg-green-500/15 text-green-500",
    ring: "border-green-500/30",
    bar: "from-green-400 via-green-500 to-emerald-500",
    accent: "text-green-600 dark:text-green-400",
  },
  amber: {
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    icon: "bg-amber-500/15 text-amber-500",
    ring: "border-amber-500/30",
    bar: "from-amber-400 via-amber-500 to-orange-500",
    accent: "text-amber-600 dark:text-amber-400",
  },
  emerald: {
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/15 text-emerald-500",
    ring: "border-emerald-500/30",
    bar: "from-emerald-400 via-emerald-500 to-teal-500",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
};

/** Shorten verbose coverageBlueprint domain names for compact badge display. */
function shortenDomain(domain: string): string {
  let short = domain
    .split(/\s+(?:and|&)\s+/i)[0] // before "and" / "&"
    .split(/[(/:\u2014,]/)[0]      // before ( / : — ,
    .trim();

  // Keep only the first word or two to stay compact on mobile
  if (short.length > 18) {
    const words = short.split(/\s+/);
    short = words[0].length >= 10 ? words[0] : words.slice(0, 2).join(" ");
  }

  return short;
}

function daysUntil(ts: TSTimestamp | undefined): number | null {
  if (!ts) return null;
  const ms = ts.toDate().getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function ExamBankPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { uid } = useAuth();
  const { courses, loading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const activeCourse = useMemo(
    () => courses.find((c) => c.id === (activeCourseId || courses[0]?.id)),
    [courses, activeCourseId]
  );
  const { stats } = useStats(activeCourse?.id ?? null);

  const [examDateInput, setExamDateInput] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const queryExamType = String(searchParams.get("exam") || "").toUpperCase();
  const courseExamType = String(activeCourse?.examType || "").toUpperCase();
  const examType = EXAM_OPTION_KEYS.has(queryExamType)
    ? queryExamType
    : EXAM_OPTION_KEYS.has(courseExamType)
      ? courseExamType
      : "SBA";
  const examMeta = EXAM_META[examType] ?? EXAM_META.SBA;
  const examEntry = useMemo(
    () => EXAM_OPTIONS.find((e) => e.key === examType),
    [examType]
  );

  const colors = COLOR_MAP[examMeta?.color ?? "blue"] ?? COLOR_MAP.blue;
  const daysLeft = daysUntil(activeCourse?.examDate as TSTimestamp | undefined);

  const {
    questions,
    totalCount,
    domainsGenerated,
    loading: bankLoading,
  } = useExamBank(examType || null);

  const answeredCount = useMemo(() => {
    if (!questions.length) return 0;
    try {
      const raw = JSON.parse(localStorage.getItem("medq_exambank_answered") || "[]") as string[];
      const answeredIds = new Set(raw);
      return questions.filter((q) => answeredIds.has(q.id)).length;
    } catch { return 0; }
  }, [questions]);
  const remainingCount = questions.length - answeredCount;

  async function handleSaveDate() {
    if (!uid || !activeCourse?.id || !examDateInput) return;
    const date = new Date(examDateInput);
    if (isNaN(date.getTime())) {
      toast.error("Please enter a valid date.");
      return;
    }
    setSavingDate(true);
    try {
      await updateDoc(doc(db, "users", uid, "courses", activeCourse.id), {
        examDate: Timestamp.fromDate(date),
      });
      toast.success("Exam date saved!");
      setExamDateInput("");
    } catch {
      toast.error("Failed to save exam date.");
    } finally {
      setSavingDate(false);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await fn.generateExamBankQuestions({ examType, count: 10 });
      toast.success("Questions ready!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed.";
      setGenerateError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleStartPractice() {
    if (!questions.length) return;
    // Filter out already-answered questions so the user picks up where they left off
    let answeredIds: Set<string>;
    try {
      const raw = JSON.parse(localStorage.getItem("medq_exambank_answered") || "[]") as string[];
      answeredIds = new Set(raw);
    } catch {
      answeredIds = new Set();
    }
    const unanswered = (questions as unknown as QuestionModel[]).filter(
      (q) => !answeredIds.has(q.id)
    );
    if (unanswered.length === 0) {
      toast("You've answered all questions! Generating a fresh set.", { duration: 3000 });
      // Clear answered tracking and restart with all questions
      try { localStorage.removeItem("medq_exambank_answered"); } catch {}
      startQuiz(questions as unknown as QuestionModel[]);
    } else {
      startQuiz(unanswered);
    }
    router.push("/practice/quiz?mode=exam-bank");
  }

  if (loading) {
    return (
      <PageLoadingState
        title="Loading your exam bank"
        description="Fetching your course and exam details."
        expectation="This is running normally. It can take a bit longer on first load."
        className="page-wrap py-16"
      />
    );
  }

  if (!activeCourse) {
    return (
      <div className="page-wrap py-24 text-center space-y-4">
        <p className="text-muted-foreground text-sm">
          No active course selected. Pick a course to open your exam question bank.
        </p>
        <Link href="/practice">
          <Button variant="outline" size="sm" className="rounded-xl">
            Go to Practice
          </Button>
        </Link>
      </div>
    );
  }

  const statItems = [
    {
      label: "Questions Answered",
      value: stats?.totalQuestionsAnswered ?? 0,
    },
    {
      label: "Accuracy",
      value:
        stats?.overallAccuracy != null
          ? `${Math.round(stats.overallAccuracy * 100)}%`
          : "—",
    },
    { label: "Study Minutes", value: stats?.totalStudyMinutes ?? 0 },
    { label: "Streak", value: stats?.streakDays ? `${stats.streakDays}d` : "—" },
  ];

  return (
    <div className="page-wrap page-stack">
      {/* Back */}
      <Link
        href="/today"
        className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className={`glass-card overflow-hidden border ${colors.ring}`}>
        <div className={`h-1 w-full bg-gradient-to-r ${colors.bar}`} />
        <div className="p-5 sm:p-7 space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            {/* Exam identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.icon}`}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold leading-tight">
                    {examEntry?.label ?? examType}
                  </h1>
                  <p className="text-xs text-muted-foreground">{examMeta.authority}</p>
                </div>
                <Badge className={`${colors.badge} border-0 text-xs`}>
                  {examEntry?.badge ?? examMeta.format}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                {examMeta.focus}
              </p>
            </div>

            {/* Countdown / Date picker */}
            {daysLeft !== null ? (
              <div className="shrink-0 rounded-2xl border border-border/60 bg-muted/30 px-6 py-4 text-center min-w-[120px]">
                <p className="text-4xl font-bold tabular-nums">
                  {daysLeft}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {daysLeft === 0 ? "Exam day!" : daysLeft === 1 ? "day to go" : "days to go"}
                </p>
                <button
                  onClick={() => setExamDateInput("")}
                  className="mt-2 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  Change date
                </button>
              </div>
            ) : (
              <div className="shrink-0 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium">When is your exam?</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={examDateInput}
                    onChange={(e) => setExamDateInput(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveDate}
                    disabled={!examDateInput || savingDate}
                    className="rounded-lg"
                  >
                    {savingDate ? "…" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/70">
                  We&apos;ll build a countdown and prioritise revision.
                </p>
              </div>
            )}
          </div>

          {/* Exam tip */}
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <Zap className={`h-4 w-4 shrink-0 mt-0.5 ${colors.accent}`} />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Exam tip: </span>
              {examMeta.tip}
            </p>
          </div>

        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statItems.map(({ label, value }) => (
          <div key={label} className="glass-card p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </section>

      {/* ── Weak topics ───────────────────────────────────────────────────── */}
      {(stats?.weakestTopics?.length ?? 0) > 0 && (
        <section className="glass-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Focus areas</h2>
            <Link
              href="/today/analytics"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Full analytics
            </Link>
          </div>
          <div className="space-y-2.5">
            {stats!.weakestTopics.slice(0, 5).map((topic) => (
              <div key={topic.tag} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{topic.tag}</span>
                <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500/70"
                    style={{
                      width: `${Math.round((1 - (topic.accuracy ?? 0)) * 100)}%`,
                    }}
                  />
                </div>
                <Link
                  href={`/ai/explore?topic=${encodeURIComponent(topic.tag)}`}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  Explore
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Question bank ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="section-label">Exam Question Bank</h2>

        {bankLoading ? (
          <SectionLoadingState
            title="Loading your question bank"
            description="Syncing generated questions, domains, and readiness state."
            expectation="This is normal and should complete shortly."
            rows={2}
          />
        ) : questions.length === 0 ? (
          /* Zero-state */
          <div className="glass-card overflow-hidden border-primary/20">
            <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />
            <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="font-semibold text-base">Generate Your Question Bank</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Claude will research the official{" "}
                  <span className="font-medium text-foreground">
                    {examEntry?.label ?? examType}
                  </span>{" "}
                  syllabus and produce high-yield SBA questions — no materials needed.
                </p>
              </div>
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl gap-2"
              >
                {generating ? (
                  <LoadingButtonLabel label="Generating high-yield questions..." />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Question Bank
                  </>
                )}
              </Button>
              {generating && (
                <InlineLoadingState
                  label="Running AI generation..."
                  hint="You can stay on this page; questions will appear automatically."
                  className="text-xs"
                />
              )}
              <p className="text-xs text-muted-foreground/70">
                ~10 questions per generation · powered by Claude
              </p>
            </div>
          </div>
        ) : (
          /* Bank ready */
          <div className="glass-card overflow-hidden border-primary/25">
            <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{totalCount} Questions Ready</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {answeredCount > 0
                      ? `${answeredCount} answered · ${remainingCount} remaining`
                      : `${domainsGenerated.length} domain${domainsGenerated.length !== 1 ? "s" : ""} covered`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <Button
                    onClick={handleStartPractice}
                    className="rounded-xl gap-1.5"
                  >
                    <Zap className="h-4 w-4" />
                    {answeredCount > 0 && remainingCount > 0
                      ? `Continue (${remainingCount} left)`
                      : answeredCount > 0
                        ? "Restart All"
                        : "Start Practice"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="rounded-xl gap-1.5"
                  >
                    {generating ? (
                      <LoadingButtonLabel label="Generating more questions..." />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Generate more
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {domainsGenerated.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(domainsGenerated)].slice(0, 12).map((domain) => (
                    <Badge
                      key={domain}
                      variant="secondary"
                      className="text-xs rounded-full px-2.5 max-w-[160px] truncate"
                    >
                      {shortenDomain(domain)}
                    </Badge>
                  ))}
                </div>
              )}

              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
