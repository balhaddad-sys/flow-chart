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
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

export default function TodayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  useEffect(() => {
    if (coursesLoading) return;

    if (courses.length === 0) {
      if (activeCourseId) setActiveCourseId(null);
      router.replace("/onboarding");
      return;
    }

    const activeStillExists = activeCourseId
      ? courses.some((course) => course.id === activeCourseId)
      : false;

    if (!activeStillExists) {
      setActiveCourseId(courses[0].id);
    }
  }, [coursesLoading, courses, activeCourseId, setActiveCourseId, router]);

  const effectiveCourseId =
    courses.find((course) => course.id === activeCourseId)?.id ??
    courses[0]?.id ??
    null;

  const activeCourse = courses.find((c) => c.id === effectiveCourseId);
  const { files, loading: filesLoading } = useFiles(effectiveCourseId);
  const { sections, loading: sectionsLoading } = useSections(effectiveCourseId);
  const { tasks: todayTasks, loading: tasksLoading } =
    useTodayTasks(effectiveCourseId);
  const { stats, loading: statsLoading } = useStats(effectiveCourseId);

  const sectionMap = useMemo(() => buildSectionMap(sections), [sections]);
  const [fixPlanLoading, setFixPlanLoading] = useState(false);

  const hasFiles = files.length > 0;
  const hasSections = sections.some((s) => s.aiStatus === "ANALYZED");
  const hasPlan = todayTasks.length > 0 || (stats?.completionPercent ?? 0) > 0;
  const hasQuizAttempts = (stats?.totalQuestionsAnswered ?? 0) > 0;
  const weakTopics = stats?.weakestTopics ?? [];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
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
      toast.success("Fix plan generated. Check your plan for updated tasks.");
    } catch {
      toast.error("Failed to generate fix plan.");
    } finally {
      setFixPlanLoading(false);
    }
  }

  const quickActions = [];
  if (!hasFiles) {
    quickActions.push({ label: "Upload Materials", href: "/library", icon: Upload });
  }
  if (hasFiles && !hasPlan) {
    quickActions.push({ label: "Generate Plan", href: "/today/plan", icon: Calendar });
  }
  if (hasSections) {
    quickActions.push({ label: "Start Quiz", href: "/practice", icon: CircleHelp });
  }
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

      {/* ── Hero section ───────────────────────────────── */}
      <section className="glass-card overflow-hidden">
        {/* Decorative top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

            {/* Left: greeting + title */}
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <span className="section-label animate-in-up stagger-1">
                  Study Command Center
                </span>
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
                    {activeCourse.title} — your personalised study plan is ready.
                  </p>
                )}
              </div>

              {(filesLoading || sectionsLoading) && (
                <div className="animate-in-up stagger-4">
                  <InlineLoadingState label="Syncing course content..." />
                </div>
              )}

              {/* Quick Actions */}
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

            {/* Right: exam countdown */}
            <div className="animate-in-up stagger-3 shrink-0">
              <ExamCountdown
                examDate={activeCourse?.examDate}
                courseTitle={activeCourse?.title}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pipeline setup progress (only shown until complete) ── */}
      <PipelineProgress
        hasFiles={hasFiles}
        hasSections={hasSections}
        hasPlan={hasPlan}
        hasQuizAttempts={hasQuizAttempts}
      />

      {/* ── Performance metrics ────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Performance Overview</h2>
          <Link href="/today/analytics" className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <BarChart3 className="h-3.5 w-3.5" />
            Full Analytics
          </Link>
        </div>
        <StatsCards stats={stats} loading={statsLoading} />
      </section>

      {/* ── Tasks + Weak Topics two-column ─────────────── */}
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
                <LoadingButtonLabel label="Generating..." />
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Generate Remediation Plan
                </>
              )}
            </Button>
          )}

          {/* Sub-page navigation */}
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
    </div>
  );
}
