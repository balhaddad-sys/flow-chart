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
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

export default function TodayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  // Zero-state: sample deck seeding
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

  // Sample deck CTA: visible when no files exist and deck hasn't been seeded
  const isSampleCourse = (activeCourse as { isSampleDeck?: boolean } | undefined)?.isSampleDeck === true;
  const showSampleDeckCTA = !hasFiles && !deckSeeded && !isSampleCourse;

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

      {/* ── Hero section ──────────────────────────────────────────────── */}
      <section className="glass-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <span className="section-label animate-in-up stagger-1">Study Command Center</span>
                <span className="section-label text-border animate-in-up stagger-1">·</span>
                <span className="section-label animate-in-up stagger-1">{todayDate}</span>
              </div>

              <div>
                <h1 className="page-title animate-in-up stagger-2">
                  {greeting()},{" "}
                  <span className="text-gradient">{user?.displayName?.split(" ")[0] || "Student"}</span>
                </h1>
                {activeCourse && (
                  <p className="page-subtitle animate-in-up stagger-3 mt-1.5">
                    {activeCourse.title}
                    {isSampleCourse ? " — Sample High-Yield Deck" : " — your personalised study plan is ready."}
                  </p>
                )}
              </div>

              {(filesLoading || sectionsLoading) && (
                <div className="animate-in-up stagger-4">
                  <InlineLoadingState label="Syncing course content…" />
                </div>
              )}

              <div className="animate-in-up stagger-4 flex flex-wrap gap-2 pt-1">
                {quickActions.slice(0, 4).map((action) => (
                  <Link key={action.href} href={action.href}>
                    <Button
                      variant={action.href === "/ai" ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl"
                    >
                      <action.icon className="mr-1.5 h-3.5 w-3.5" />
                      {action.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>

            <div className="animate-in-up stagger-3 shrink-0">
              <ExamCountdown examDate={activeCourse?.examDate} courseTitle={activeCourse?.title} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Zero-state: Sample Deck CTA ───────────────────────────────── */}
      {showSampleDeckCTA && (
        <section className="glass-card overflow-hidden border-primary/20">
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Try a Sample High-Yield Deck</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Experience the full assessment engine instantly — 10 pre-authored Cardiology &
                Pharmacology SBAs. No upload required.
              </p>
            </div>
            <Button
              onClick={handleSeedSampleDeck}
              disabled={seedingDeck}
              className="shrink-0 rounded-xl"
            >
              {seedingDeck ? (
                <LoadingButtonLabel label="Loading…" />
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

      {/* ── Pipeline setup progress ───────────────────────────────────── */}
      <PipelineProgress
        hasFiles={hasFiles}
        hasSections={hasSections}
        hasPlan={hasPlan}
        hasQuizAttempts={hasQuizAttempts}
      />

      {/* ── Diagnostic directive (actionable analytics) ───────────────── */}
      {diagnosticDirectives.length > 0 && (
        <DiagnosticDirective
          directives={diagnosticDirectives}
          overallAccuracy={stats?.overallAccuracy}
        />
      )}

      {/* ── Performance metrics ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Performance Overview</h2>
          <Link
            href="/today/analytics"
            className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Full Analytics
          </Link>
        </div>
        <StatsCards stats={stats} loading={statsLoading} />
      </section>

      {/* ── Tasks + Weak Topics two-column ───────────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <TodayChecklist tasks={todayTasks} loading={tasksLoading} sectionMap={sectionMap} />

        <div className="space-y-4">
          <WeakTopicsBanner topics={weakTopics} />

          {weakTopics.length > 0 && (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleFixPlan}
              disabled={fixPlanLoading || !effectiveCourseId}
            >
              {fixPlanLoading ? (
                <LoadingButtonLabel label="Generating…" />
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Generate Remediation Plan
                </>
              )}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/today/plan" className="block">
              <Button variant="outline" size="sm" className="w-full rounded-xl">
                <Calendar className="mr-2 h-3.5 w-3.5" />
                Full Plan
              </Button>
            </Link>
            <Link href="/today/analytics" className="block">
              <Button variant="outline" size="sm" className="w-full rounded-xl">
                <BarChart3 className="mr-2 h-3.5 w-3.5" />
                Analytics
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Streak graph (shown once user has answered questions) ─────── */}
      {hasQuizAttempts && <StreakGraph />}
    </div>
  );
}
