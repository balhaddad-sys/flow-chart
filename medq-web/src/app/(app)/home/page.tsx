"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useTodayTasks } from "@/lib/hooks/useTasks";
import { useStats } from "@/lib/hooks/useStats";
import { useFiles } from "@/lib/hooks/useFiles";
import { useCourseStore } from "@/lib/stores/course-store";
import { StatsCards } from "@/components/home/stats-cards";
import { TodayChecklist } from "@/components/home/today-checklist";
import { ExamCountdown } from "@/components/home/exam-countdown";
import { WeakTopicsBanner } from "@/components/home/weak-topics-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CalendarDays, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, loading: coursesLoading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  // Keep active course selection valid and redirect only when user has no courses.
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
  const { tasks: todayTasks, loading: tasksLoading } = useTodayTasks(effectiveCourseId);
  const { stats } = useStats(effectiveCourseId);

  const hasFiles = files.length > 0;
  const hasTasks = todayTasks.length > 0;
  const showGettingStarted = !hasFiles || !hasTasks;

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

      {showGettingStarted && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">Getting Started</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {hasFiles ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {hasFiles ? "Materials uploaded" : "Upload study materials"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasFiles
                      ? "Your files are being processed into sections and questions."
                      : "Go to the Library and upload PDFs, PPTX, or DOCX files."}
                  </p>
                </div>
                {!hasFiles && (
                  <Link href="/library">
                    <Button size="sm">Upload</Button>
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasTasks ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {hasTasks ? "Study plan active" : "Generate your study plan"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasTasks
                      ? "Check your daily tasks below."
                      : hasFiles
                        ? "Go to the Planner to create your personalized schedule."
                        : "Available after uploading materials."}
                  </p>
                </div>
                {!hasTasks && hasFiles && (
                  <Link href="/planner">
                    <Button size="sm">Plan</Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <StatsCards stats={stats} />

      <WeakTopicsBanner topics={stats?.weakestTopics ?? []} />

      <TodayChecklist tasks={todayTasks} loading={tasksLoading} />
    </div>
  );
}
