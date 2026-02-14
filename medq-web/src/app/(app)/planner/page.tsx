"use client";

import { useState, useEffect, useRef } from "react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { groupTasksByDay } from "@/lib/utils/date";
import { TaskRow } from "@/components/planner/task-row";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Plus, CalendarDays } from "lucide-react";
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

  async function handleGenerate() {
    if (!courseId || !activeCourse) return;
    setError(null);
    setGenerating(true);
    try {
      // Map course availability to scheduler format
      // createCourse stores { perDayOverrides: { monday: 120, ... } }
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          {tasks.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {doneCount}/{tasks.length} tasks completed
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tasks.length === 0 ? (
            <Button onClick={handleGenerate} disabled={generating || !courseId}>
              <Plus className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : "Generate Plan"}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleRegen} disabled={generating}>
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating..." : "Regenerate"}
            </Button>
          )}
        </div>
      </div>

      {(error || taskError) && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error || taskError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No study plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a study plan to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <Badge variant="secondary" className="text-xs">
                  {group.tasks.length}
                </Badge>
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
