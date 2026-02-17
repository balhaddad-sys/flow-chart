"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useTodayTasks } from "@/lib/hooks/useTasks";
import { useStats } from "@/lib/hooks/useStats";
import { useFiles } from "@/lib/hooks/useFiles";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { StatsCards } from "@/components/home/stats-cards";
import { TodayChecklist } from "@/components/home/today-checklist";
import { ExamCountdown } from "@/components/home/exam-countdown";
import { WeakTopicsBanner } from "@/components/home/weak-topics-banner";
import { PipelineProgress } from "@/components/home/pipeline-progress";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Calendar,
  CircleHelp,
  Sparkles,
  BarChart3,
  Wrench,
  Loader2,
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
  const { files } = useFiles(effectiveCourseId);
  const { sections } = useSections(effectiveCourseId);
  const { tasks: todayTasks, loading: tasksLoading } =
    useTodayTasks(effectiveCourseId);
  const { stats } = useStats(effectiveCourseId);

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

  async function handleFixPlan() {
    if (!effectiveCourseId) return;
    setFixPlanLoading(true);
    try {
      await fn.runFixPlan({ courseId: effectiveCourseId });
      toast.success("Fix plan generated! Check your plan for new tasks.");
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

  return (
    <div className="page-wrap page-stack">
      {/* Header: Greeting + Exam countdown */}
      <section className="glass-card overflow-hidden p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="animate-in-up stagger-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Study Command Center
            </p>
            <h1 className="animate-in-up stagger-2 page-title break-words">
              {greeting()},{" "}
              <span className="text-gradient">{user?.displayName || "Student"}</span>
            </h1>
            {activeCourse && (
              <p className="animate-in-up stagger-3 page-subtitle break-words">{activeCourse.title}</p>
            )}
          </div>
          <div className="animate-in-up stagger-2">
            <ExamCountdown
              examDate={activeCourse?.examDate}
              courseTitle={activeCourse?.title}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap animate-in-up stagger-4">
          {quickActions.slice(0, 4).map((action) => (
            <Link key={action.href} href={action.href} className="w-full sm:w-auto">
              <Button
                variant={action.href === "/ai" ? "default" : "outline"}
                size="sm"
                className="w-full justify-start sm:w-auto sm:justify-center rounded-xl transition-all active:scale-[0.97]"
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </section>

      {/* Pipeline Progress */}
      <PipelineProgress
        hasFiles={hasFiles}
        hasSections={hasSections}
        hasPlan={hasPlan}
        hasQuizAttempts={hasQuizAttempts}
      />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Today's Tasks + Weak Topics */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <TodayChecklist tasks={todayTasks} loading={tasksLoading} />
        <div className="space-y-4">
          <WeakTopicsBanner topics={weakTopics} />

          {/* Fix Plan button */}
          {weakTopics.length > 0 && (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleFixPlan}
              disabled={fixPlanLoading || !effectiveCourseId}
            >
              {fixPlanLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              Generate Fix Plan
            </Button>
          )}
        </div>
      </div>

      {/* Sub-page links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/today/plan">
          <Button variant="outline" size="sm" className="rounded-xl">
            <Calendar className="mr-2 h-4 w-4" />
            View Full Plan
          </Button>
        </Link>
        <Link href="/today/analytics">
          <Button variant="outline" size="sm" className="rounded-xl">
            <BarChart3 className="mr-2 h-4 w-4" />
            View Analytics
          </Button>
        </Link>
      </div>
    </div>
  );
}
