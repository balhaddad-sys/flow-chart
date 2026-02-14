"use client";

import { useEffect } from "react";
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
import { Upload, Calendar, CircleHelp, MessageSquare } from "lucide-react";

export default function HomePage() {
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
    courses.find((course) => course.id === activeCourseId)?.id ?? courses[0]?.id ?? null;

  const activeCourse = courses.find((c) => c.id === effectiveCourseId);
  const { files } = useFiles(effectiveCourseId);
  const { sections } = useSections(effectiveCourseId);
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks(effectiveCourseId);
  const { stats } = useStats(effectiveCourseId);

  const hasFiles = files.length > 0;
  const hasSections = sections.some((s) => s.aiStatus === "ANALYZED");
  const hasPlan = todayTasks.length > 0 || (stats?.completionPercent ?? 0) > 0;
  const hasQuizAttempts = (stats?.totalQuestionsAnswered ?? 0) > 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const quickActions = [];
  if (!hasFiles) {
    quickActions.push({ label: "Upload Materials", href: "/library", icon: Upload });
  }
  if (hasFiles && !hasPlan) {
    quickActions.push({ label: "Generate Plan", href: "/planner", icon: Calendar });
  }
  if (hasSections) {
    quickActions.push({ label: "Start Quiz", href: "/questions", icon: CircleHelp });
  }
  quickActions.push({ label: "AI Chat", href: "/chat", icon: MessageSquare });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:space-y-8 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting()}, {user?.displayName || "Student"}
          </h1>
          {activeCourse && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {activeCourse.title}
            </p>
          )}
        </div>
        <ExamCountdown
          examDate={activeCourse?.examDate}
          courseTitle={activeCourse?.title}
        />
      </div>

      {/* Pipeline Progress */}
      <PipelineProgress
        hasFiles={hasFiles}
        hasSections={hasSections}
        hasPlan={hasPlan}
        hasQuizAttempts={hasQuizAttempts}
      />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Today's Tasks */}
      <TodayChecklist tasks={todayTasks} loading={tasksLoading} />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.slice(0, 3).map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant="outline" size="sm">
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Weak Topics */}
      <WeakTopicsBanner topics={stats?.weakestTopics ?? []} />
    </div>
  );
}
