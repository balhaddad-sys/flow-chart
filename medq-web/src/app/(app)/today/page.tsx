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

  const quickActions = [];
  if (!hasFiles) quickActions.push({ label: "Upload Materials", href: "/library", icon: Upload });
  if (hasFiles && !hasPlan) quickActions.push({ label: "Generate Plan", href: "/today/plan", icon: Calendar });
  if (hasSections) quickActions.push({ label: "Start Quiz", href: "/practice", icon: CircleHelp });
  quickActions.push({ label: "AI Chat", href: "/ai", icon: Sparkles });

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
      <section>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{todayDate}</p>
            <h1 className="page-title">
              {greeting()}, {user?.displayName?.split(" ")[0] || "Student"}
            </h1>
            {activeCourse && (
              <p className="text-sm text-muted-foreground">
                {activeCourse.title}
                {isSampleCourse && " — Sample Deck"}
              </p>
            )}

            {(filesLoading || sectionsLoading) && (
              <InlineLoadingState label="Syncing course content..." />
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {quickActions.slice(0, 4).map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button
                    variant={action.href === "/ai" ? "default" : "outline"}
                    size="sm"
                  >
                    <action.icon className="mr-1.5 h-3.5 w-3.5" />
                    {action.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <ExamCountdown examDate={activeCourse?.examDate} courseTitle={activeCourse?.title} />
        </div>
      </section>

      {/* ── Sample Deck CTA ────────────────────────────────────────── */}
      {showSampleDeckCTA && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Zap className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Try a Sample High-Yield Deck</p>
              <p className="text-sm text-muted-foreground mt-0.5">
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
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Trophy className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{examShortLabel} Question Bank</p>
              <p className="text-sm text-muted-foreground mt-0.5">
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
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Performance</h2>
          <Link
            href="/today/analytics"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </Link>
        </div>
        <StatsCards stats={stats} loading={statsLoading} />
      </section>

      {/* ── Tasks + Weak Topics ────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <TodayChecklist tasks={todayTasks} loading={tasksLoading} sectionMap={sectionMap} />

        <div className="space-y-4">
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
                  Generate Remediation Plan
                </>
              )}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Link href="/today/plan" className="block">
              <Button variant="outline" size="sm" className="w-full">
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Full Plan
              </Button>
            </Link>
            <Link href="/today/analytics" className="block">
              <Button variant="outline" size="sm" className="w-full">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                Analytics
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Streak ─────────────────────────────────────────────────── */}
      {hasQuizAttempts && <StreakGraph />}
    </div>
  );
}
