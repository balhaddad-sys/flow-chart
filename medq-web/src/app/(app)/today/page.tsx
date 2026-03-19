"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useTodayTasks } from "@/lib/hooks/useTasks";
import { useStats } from "@/lib/hooks/useStats";
import { useFiles } from "@/lib/hooks/useFiles";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { buildSectionMap } from "@/lib/utils/task-title";
import { StatsCards } from "@/components/home/stats-cards";
import { TodayChecklist } from "@/components/home/today-checklist";
import { ExamCountdown } from "@/components/home/exam-countdown";
import { WeakTopicsBanner } from "@/components/home/weak-topics-banner";
import { DiagnosticDirective } from "@/components/home/diagnostic-directive";
import { StreakGraph } from "@/components/home/streak-graph";
import { PipelineProgress } from "@/components/home/pipeline-progress";
import { Button } from "@/components/ui/button";
import {
  PageLoadingState,
  InlineLoadingState,
  LoadingButtonLabel,
} from "@/components/ui/loading-state";
import { PhaseLoadingCard } from "@/components/ui/phase-loading-card";
import {
  Upload,
  Calendar,
  CircleHelp,
  Sparkles,
  BarChart3,
  Wrench,
  Zap,
  BookOpen,
  Trophy,
  ChevronRight,
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

const REAL_EXAM_TYPES = new Set([
  "PLAB1", "PLAB2", "MRCP_PART1", "MRCP_PACES", "MRCGP_AKT",
  "USMLE_STEP1", "USMLE_STEP2", "FINALS",
]);

const EXAM_SHORT_LABEL: Record<string, string> = {
  PLAB1: "PLAB 1",
  PLAB2: "PLAB 2",
  MRCP_PART1: "MRCP Part 1",
  MRCP_PACES: "MRCP PACES",
  MRCGP_AKT: "MRCGP AKT",
  USMLE_STEP1: "USMLE Step 1",
  USMLE_STEP2: "USMLE Step 2",
  FINALS: "Finals",
};

export default function TodayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  const [seedingDeck, setSeedingDeck] = useState(false);
  const [deckSeeded, setDeckSeeded] = useState(false);

  useEffect(() => {
    if (coursesLoading) return;
    if (courses.length === 0) {
      if (activeCourseId) setActiveCourseId(null);
      router.replace("/onboarding");
      return;
    }
    const activeStillExists = activeCourseId
      ? courses.some((c) => c.id === activeCourseId)
      : false;
    if (!activeStillExists) setActiveCourseId(courses[0].id);
  }, [coursesLoading, courses, activeCourseId, setActiveCourseId, router]);

  const effectiveCourseId =
    courses.find((c) => c.id === activeCourseId)?.id ?? courses[0]?.id ?? null;
  const activeCourse = courses.find((c) => c.id === effectiveCourseId);

  const { files, loading: filesLoading } = useFiles(effectiveCourseId);
  const { sections, loading: sectionsLoading } = useSections(effectiveCourseId);
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks(effectiveCourseId);
  const { stats, loading: statsLoading } = useStats(effectiveCourseId);

  const sectionMap = useMemo(() => buildSectionMap(sections), [sections]);
  const [fixPlanLoading, setFixPlanLoading] = useState(false);
  const [fixPlanPhase, setFixPlanPhase] = useState("idle");
  const [seedPhase, setSeedPhase] = useState("idle");

  const hasFiles = files.length > 0;
  const hasSections = sections.some((s) => s.aiStatus === "ANALYZED");
  const hasPlan = todayTasks.length > 0 || (stats?.completionPercent ?? 0) > 0;
  const hasQuizAttempts = (stats?.totalQuestionsAnswered ?? 0) > 0;
  const weakTopics = stats?.weakestTopics ?? [];
  const diagnosticDirectives = stats?.diagnosticDirectives ?? [];

  const isSampleCourse = (activeCourse as { isSampleDeck?: boolean } | undefined)?.isSampleDeck === true;
  const showSampleDeckCTA = !hasFiles && !deckSeeded && !isSampleCourse;

  const examType = (activeCourse as { examType?: string } | undefined)?.examType ?? "";
  const isRealExam = REAL_EXAM_TYPES.has(examType);
  const examShortLabel = EXAM_SHORT_LABEL[examType] ?? examType;
  const examBankHref = examType
    ? `/practice/exam-bank?exam=${encodeURIComponent(examType)}`
    : "/practice/exam-bank";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const todayDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function handleFixPlan() {
    if (!effectiveCourseId) return;
    setFixPlanLoading(true);
    setFixPlanPhase("analyze");
    try {
      // Phase transitions on a timer since we can't observe the function internals
      const phaseTimer = setTimeout(() => setFixPlanPhase("plan"), 3000);
      const phaseTimer2 = setTimeout(() => setFixPlanPhase("save"), 7000);
      await fn.runFixPlan({ courseId: effectiveCourseId });
      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);
      setFixPlanPhase("done");
      toast.success("Remediation plan generated. Check your plan for updated tasks.");
    } catch {
      setFixPlanPhase("analyze");
      toast.error("Failed to generate fix plan.");
    } finally {
      setFixPlanLoading(false);
      setTimeout(() => setFixPlanPhase("idle"), 2000);
    }
  }

  async function handleSeedSampleDeck() {
    setSeedingDeck(true);
    setSeedPhase("create");
    try {
      const t1 = setTimeout(() => setSeedPhase("generate"), 3000);
      const t2 = setTimeout(() => setSeedPhase("finalize"), 8000);
      const result = await fn.seedSampleDeck();
      clearTimeout(t1);
      clearTimeout(t2);
      setSeedPhase("done");
      if (result.alreadySeeded) {
        toast.info("Sample deck is already in your account.");
      } else {
        toast.success(`Sample deck ready — ${result.questionCount} high-yield questions loaded!`);
        setDeckSeeded(true);
        if (result.courseId) setActiveCourseId(result.courseId);
      }
    } catch {
      toast.error("Failed to load sample deck.");
    } finally {
      setSeedingDeck(false);
      setTimeout(() => setSeedPhase("idle"), 2000);
    }
  }

  // Find the most actionable next step for the user
  const inProgressTask = todayTasks.find((t) => t.status === "IN_PROGRESS");
  const nextTodoTask = todayTasks.find((t) => t.status === "TODO");
  const continueTask = inProgressTask || nextTodoTask;

  const primaryAction = !hasFiles
    ? { label: "Upload Materials", href: "/library", icon: Upload }
    : hasFiles && !hasPlan
      ? { label: "Generate Plan", href: "/today/plan", icon: Calendar }
      : continueTask
        ? {
            label: continueTask.status === "IN_PROGRESS" ? "Continue Studying" : "Start Next Task",
            href: continueTask.type === "QUESTIONS"
              ? `/practice/quiz?section=${continueTask.sectionIds?.[0] ?? ""}`
              : continueTask.sectionIds?.[0]
                ? `/study/${continueTask.id}/${continueTask.sectionIds[0]}`
                : "/practice",
            icon: ChevronRight,
          }
        : hasSections
          ? { label: "Start Quiz", href: "/practice", icon: CircleHelp }
          : { label: "AI Chat", href: "/ai", icon: Sparkles };

  if (coursesLoading) {
    return (
      <PageLoadingState
        title="Loading your dashboard"
        description="Preparing your courses, tasks, and progress data."
        className="page-wrap py-16"
      />
    );
  }

  return (
    <main className="page-wrap page-stack" aria-label="Today dashboard">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="animate-in-up" aria-label="Dashboard header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide">{todayDate}</p>
            <h1 className="page-title mt-1">
              {greeting()}, {user?.displayName?.split(" ")[0] || "Student"}
            </h1>
            {activeCourse && (
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {activeCourse.title}
                {isSampleCourse && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Sample
                  </span>
                )}
              </p>
            )}

            {(filesLoading || sectionsLoading) && (
              <div className="mt-2">
                <InlineLoadingState
                  label="Syncing course content..."
                  hint="This is normal after uploads and usually settles within a minute."
                />
              </div>
            )}

            {/* Hero CTA — one clear next action */}
            <Link
              href={primaryAction.href}
              className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10 max-w-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <primaryAction.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{primaryAction.label}</p>
                <p className="text-xs text-muted-foreground">
                  {!hasFiles ? "Upload your study materials" :
                   !hasPlan ? "Set up your personalized schedule" :
                   hasSections ? "Test your knowledge" : "Ask AI anything"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-primary shrink-0" />
            </Link>
          </div>

          <ExamCountdown examDate={activeCourse?.examDate} courseTitle={activeCourse?.title} />
        </div>
      </section>

      {/* ── Sample Deck CTA ────────────────────────────────────────── */}
      {showSampleDeckCTA && (
        <section className="animate-in-up stagger-1 surface-interactive p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Try a Sample High-Yield Deck</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                10 pre-authored Cardiology & Pharmacology SBAs. No upload required.
              </p>
            </div>
            <Button
              onClick={handleSeedSampleDeck}
              disabled={seedingDeck}
              size="sm"
              className="shrink-0"
            >
              {seedingDeck ? (
                <LoadingButtonLabel label="Loading..." />
              ) : (
                <>
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  Try Sample Deck
                </>
              )}
            </Button>
          </div>
          {seedingDeck && seedPhase !== "idle" && (
            <PhaseLoadingCard
              phases={[
                { key: "create", label: "Creating sample course" },
                { key: "generate", label: "Loading high-yield questions" },
                { key: "finalize", label: "Setting up your deck" },
              ]}
              activePhase={seedPhase}
              complete={seedPhase === "done"}
              completeMessage="Sample deck ready!"
              className="mt-3"
            />
          )}
        </section>
      )}

      {/* ── Exam prep card ──────────────────────────────────────────── */}
      {isRealExam && (
        <section className="animate-in-up stagger-2 surface-interactive p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{examShortLabel} Question Bank</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Practise with exam-specific questions and track weak topics.
              </p>
            </div>
            <Link href={examBankHref} className="shrink-0">
              <Button size="sm" className="gap-1.5">
                Open Bank
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ── Next Steps guidance ─────────────────────────────────────── */}
      {!hasFiles && !isSampleCourse && (
        <section className="animate-in-up stagger-2 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Get started by uploading your study materials</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a PDF, DOCX, or PPTX and AI will extract sections, generate questions, and create your study plan automatically.
              </p>
              <Link href="/library" className="mt-3 inline-block">
                <Button size="sm">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Materials
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {hasFiles && !hasSections && (
        <section className="animate-in-up stagger-2 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 mt-2 shrink-0 rounded-full bg-amber-500 animate-glow-pulse" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Your materials are being analyzed</p>
              <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
                AI is extracting sections and generating questions. This usually takes 1-3 minutes. You&apos;ll be notified when ready.
              </p>
            </div>
          </div>
        </section>
      )}

      {hasSections && !hasPlan && (
        <section className="animate-in-up stagger-2 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Your materials are ready — generate your study plan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Set your exam date and daily availability, and we&apos;ll create a personalized study schedule.
              </p>
              <Link href="/today/plan" className="mt-3 inline-block">
                <Button size="sm">
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  Generate Plan
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Continue where you left off ──────────────────────────── */}
      {continueTask && hasPlan && (
        <section className="animate-in-up stagger-2 surface-hero p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {continueTask.status === "IN_PROGRESS" ? "Continue where you left off" : "Up next"}
              </p>
              <p className="text-sm font-semibold truncate mt-0.5">
                {sectionMap.get(continueTask.sectionIds?.[0] ?? "")?.title ?? continueTask.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {continueTask.type} · {continueTask.estMinutes}min
              </p>
            </div>
            <Link href={primaryAction.href}>
              <Button size="sm" className="shrink-0 gap-1.5">
                {continueTask.status === "IN_PROGRESS" ? "Resume" : "Start"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* ── Today's Tasks ──────────────────────────────────────────── */}
      {hasPlan && (
        <section className="animate-in-up stagger-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-label">Today&apos;s Tasks</h2>
            <Link
              href="/today/plan"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Full Plan
            </Link>
          </div>
          <TodayChecklist tasks={todayTasks} loading={tasksLoading} sectionMap={sectionMap} />
        </section>
      )}

      {/* ── Pipeline progress (only before plan exists) ─────────────── */}
      {!hasPlan && (
        <PipelineProgress
          hasFiles={hasFiles}
          hasSections={hasSections}
          hasPlan={hasPlan}
          hasQuizAttempts={hasQuizAttempts}
        />
      )}

      {/* ── Weak Topics (actionable) ──────────────────────────────── */}
      {weakTopics.length > 0 && (
        <section className="animate-in-up stagger-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-label">Areas to Improve</h2>
            {weakTopics.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleFixPlan}
                disabled={fixPlanLoading || !effectiveCourseId}
              >
                {fixPlanLoading ? (
                  <LoadingButtonLabel label="Generating..." />
                ) : (
                  <>
                    <Wrench className="h-3 w-3" />
                    Fix Plan
                  </>
                )}
              </Button>
            )}
          </div>
          {fixPlanLoading && fixPlanPhase !== "idle" && (
            <PhaseLoadingCard
              phases={[
                { key: "analyze", label: "Analyzing weak topics" },
                { key: "plan", label: "Building remediation tasks" },
                { key: "save", label: "Saving to your plan" },
              ]}
              activePhase={fixPlanPhase}
              complete={fixPlanPhase === "done"}
              completeMessage="Fix plan ready!"
              className="mb-3"
            />
          )}
          <WeakTopicsBanner topics={weakTopics} />
        </section>
      )}

      {/* ── Diagnostic directives ──────────────────────────────────── */}
      {diagnosticDirectives.length > 0 && (
        <DiagnosticDirective
          directives={diagnosticDirectives}
          overallAccuracy={stats?.overallAccuracy}
        />
      )}

      {/* ── Performance (lower priority) ───────────────────────────── */}
      {hasQuizAttempts && (
        <section className="animate-in-up stagger-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Performance</h2>
            <Link
              href="/today/analytics"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <BarChart3 className="h-3 w-3" />
              View Analytics
            </Link>
          </div>
          <StatsCards stats={stats} loading={statsLoading} />
        </section>
      )}

      {/* ── Streak ─────────────────────────────────────────────────── */}
      {hasQuizAttempts && <StreakGraph />}
    </main>
  );
}
