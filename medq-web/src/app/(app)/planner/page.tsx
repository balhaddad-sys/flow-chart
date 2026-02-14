"use client";

import { useState, useEffect, useRef } from "react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { groupTasksByDay } from "@/lib/utils/date";
import { TaskRow } from "@/components/planner/task-row";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Plus, CalendarDays, BookOpen, HelpCircle, RotateCcw } from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

export default function PlannerPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { courses } = useCourses();
  const activeCourse = courses.find((c) => c.id === courseId);
  const { tasks, loading, error: taskError } = useTasks(courseId);
  const { sections, loading: sectionsLoading } = useSections(courseId);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoGenTriggered = useRef(false);

  // Auto-generate plan when ALL sections are done processing and no tasks exist
  const analyzedCount = sections.filter((s) => s.aiStatus === "ANALYZED").length;
  const pendingOrProcessing = sections.filter(
    (s) => s.aiStatus === "PENDING" || s.aiStatus === "PROCESSING"
  ).length;
  useEffect(() => {
    if (
      !loading &&
      !sectionsLoading &&
      !generating &&
      !autoGenTriggered.current &&
      tasks.length === 0 &&
      analyzedCount > 0 &&
      pendingOrProcessing === 0 &&
      courseId &&
      activeCourse
    ) {
      autoGenTriggered.current = true;
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sectionsLoading, tasks.length, analyzedCount, pendingOrProcessing, courseId]);

  const groups = groupTasksByDay(tasks);
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const studyCount = tasks.filter((t) => t.type === "STUDY").length;
  const quizCount = tasks.filter((t) => t.type === "QUESTIONS").length;
  const reviewCount = tasks.filter((t) => t.type === "REVIEW").length;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.estMinutes, 0);

  async function handleGenerate() {
    if (!courseId || !activeCourse) return;
    setError(null);
    setGenerating(true);
    try {
      const courseAvail = activeCourse.availability ?? {};
      const availability = {
        defaultMinutesPerDay: courseAvail.defaultMinutesPerDay,
        perDayOverrides: courseAvail.perDayOverrides ?? courseAvail.perDay ?? {},
        excludedDates: courseAvail.excludedDates,
      };

      const result = await fn.generateSchedule({
        courseId,
        availability,
        revisionPolicy: "standard",
      });
      if (!result.feasible) {
        setError(
          `Not enough study days. You need ${result.deficit ?? 0} more minutes.`
        );
        toast.warning("Schedule generated but not all topics fit.");
      } else {
        toast.success(`Study plan generated! ${result.taskCount ?? 0} tasks created.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate schedule");
      toast.error("Failed to generate schedule.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegen() {
    if (!courseId) return;
    setError(null);
    setGenerating(true);
    try {
      await fn.regenSchedule({ courseId });
      await handleGenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
      toast.error("Failed to regenerate schedule.");
    } finally {
      setGenerating(false);
    }
  }

  // Today group gets special treatment
  const todayGroup = groups.find((g) => g.label === "Today");
  const upcomingGroups = groups.filter((g) => g.label !== "Today");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold sm:text-2xl">Study Planner</h1>
          {tasks.length === 0 ? (
            <Button onClick={handleGenerate} disabled={generating || !courseId} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {generating ? "Generating..." : "Generate Plan"}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleRegen} disabled={generating}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating..." : "Regenerate"}
            </Button>
          )}
        </div>

        {/* Progress overview */}
        {tasks.length > 0 && (
          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">{pct}%</p>
                <p className="text-xs text-muted-foreground">{doneCount} of {tasks.length} tasks done</p>
              </div>
              <p className="text-xs text-muted-foreground">
                ~{Math.round(totalMinutes / 60)}h total
              </p>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-blue-500" /> {studyCount} study
              </span>
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-violet-500" /> {quizCount} quiz
              </span>
              <span className="flex items-center gap-1">
                <RotateCcw className="h-3 w-3 text-amber-500" /> {reviewCount} review
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {(error || taskError) && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error || taskError}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No study plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload materials, then generate your plan.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today section - highlighted */}
          {todayGroup && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold">Today</h2>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {todayGroup.tasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {todayGroup.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming days */}
          {upcomingGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.tasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
