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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageLoadingState,
  InlineLoadingState,
  LoadingButtonLabel,
} from "@/components/ui/loading-state";
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
  MoreHorizontal,
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
    try {
      await fn.runFixPlan({ courseId: effectiveCourseId });
      toast.success("Remediation plan generated. Check your plan for updated tasks.");
    } catch {
      toast.error("Failed to generate fix plan.");
    } finally {
      setFixPlanLoading(false);
    }
  }

  async function handleSeedSampleDeck() {
    setSeedingDeck(true);
    try {
      const result = await fn.seedSampleDeck();
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
    }
  }

  const primaryAction = !hasFiles
    ? { label: "Upload Materials", href: "/library", icon: Upload }
    : hasFiles && !hasPlan
      ? { label: "Generate Plan", href: "/today/plan", icon: Calendar }
      : hasSections
        ? { label: "Start Quiz", href: "/practice", icon: CircleHelp }
        : { label: "AI Chat", href: "/ai", icon: Sparkles };

  const secondaryActions = [
    { label: "Library", href: "/library", visible: primaryAction.href !== "/library" },
    { label: "Plan", href: "/today/plan", visible: primaryAction.href !== "/today/plan" },
    { label: "Practice", href: "/practice", visible: primaryAction.href !== "/practice" },
    { label: "AI Chat", href: "/ai", visible: primaryAction.href !== "/ai" },
    { label: "Analytics", href: "/today/analytics", visible: true },
  ].filter((action) => action.visible);

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
    <div className="page-wrap page-stack">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="animate-in-up">
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
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
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

            <div className="mt-4 flex items-center gap-2">
              <Link href={primaryAction.href}>
                <Button size="sm">
                  <primaryAction.icon className="mr-1.5 h-3.5 w-3.5" />
                  {primaryAction.label}
                </Button>
              </Link>
              {secondaryActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {secondaryActions.map((action) => (
                      <DropdownMenuItem
                        key={action.href}
                        onSelect={() => router.push(action.href)}
                      >
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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

      {/* ── Pipeline progress ──────────────────────────────────────── */}
      <PipelineProgress
        hasFiles={hasFiles}
        hasSections={hasSections}
        hasPlan={hasPlan}
        hasQuizAttempts={hasQuizAttempts}
      />

      {/* ── Diagnostic directives ──────────────────────────────────── */}
      {diagnosticDirectives.length > 0 && (
        <DiagnosticDirective
          directives={diagnosticDirectives}
          overallAccuracy={stats?.overallAccuracy}
        />
      )}

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <section className="animate-in-up stagger-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Performance</h2>
          <Link
            href="/today/analytics"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            View analytics
          </Link>
        </div>
        <StatsCards stats={stats} loading={statsLoading} />
      </section>

      {/* ── Tasks + Weak Topics ────────────────────────────────────── */}
      <section className="animate-in-up stagger-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <TodayChecklist tasks={todayTasks} loading={tasksLoading} sectionMap={sectionMap} />

        <div className="space-y-3">
          <WeakTopicsBanner topics={weakTopics} />

          {weakTopics.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleFixPlan}
              disabled={fixPlanLoading || !effectiveCourseId}
            >
              {fixPlanLoading ? (
                <LoadingButtonLabel label="Generating..." />
              ) : (
                <>
                  <Wrench className="mr-2 h-3.5 w-3.5" />
                  Remediation Plan
                </>
              )}
            </Button>
          )}

          <Link href="/today/plan" className="block">
            <Button variant="outline" size="sm" className="w-full text-[12px]">
              <Calendar className="mr-1 h-3.5 w-3.5" />
              Open Plan Workspace
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Streak ─────────────────────────────────────────────────── */}
      {hasQuizAttempts && <StreakGraph />}
    </div>
  );
}
