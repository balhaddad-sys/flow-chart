"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useTodayTasks } from "@/lib/hooks/useTasks";
import { useStats } from "@/lib/hooks/useStats";
import { useCourseStore } from "@/lib/stores/course-store";
import { StatsCards } from "@/components/home/stats-cards";
import { TodayChecklist } from "@/components/home/today-checklist";
import { ExamCountdown } from "@/components/home/exam-countdown";
import { WeakTopicsBanner } from "@/components/home/weak-topics-banner";

export default function HomePage() {
  const { user } = useAuth();
  const { courses } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  // Auto-select first course if none selected
  const effectiveCourseId = activeCourseId ?? courses[0]?.id ?? null;
  useEffect(() => {
    if (effectiveCourseId && !activeCourseId && courses.length > 0) {
      setActiveCourseId(effectiveCourseId);
    }
  }, [effectiveCourseId, activeCourseId, courses.length, setActiveCourseId]);

  const activeCourse = courses.find((c) => c.id === effectiveCourseId);
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks(effectiveCourseId);
  const { stats } = useStats(effectiveCourseId);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {user?.displayName || "Student"}
        </h1>
        {activeCourse && (
          <p className="mt-1 text-muted-foreground">
            Studying: {activeCourse.title}
          </p>
        )}
      </div>

      <ExamCountdown
        examDate={activeCourse?.examDate}
        courseTitle={activeCourse?.title}
      />

      <StatsCards stats={stats} />

      <WeakTopicsBanner topics={stats?.weakestTopics ?? []} />

      <TodayChecklist tasks={todayTasks} loading={tasksLoading} />
    </div>
  );
}
