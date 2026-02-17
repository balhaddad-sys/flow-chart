"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTasks } from "@/lib/hooks/useTasks";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { groupTasksByDay } from "@/lib/utils/date";
import { TaskRow } from "@/components/planner/task-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NumberTicker } from "@/components/ui/animate-in";
import {
  RefreshCw,
  Plus,
  CalendarDays,
  BookOpen,
  HelpCircle,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

export default function PlanPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { courses } = useCourses();
  const activeCourse = courses.find((c) => c.id === courseId);
  const { tasks, loading, error: taskError } = useTasks(courseId);
  const { sections, loading: sectionsLoading } = useSections(courseId);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoGenTriggered = useRef(false);

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
        toast.error("Not enough available study time to generate the full plan.");
      } else {
        if (result.extendedWindow) {
          const spillDays = result.spillDays ?? 0;
          toast.warning(
            spillDays > 0
              ? `Plan generated with ${result.taskCount ?? 0} tasks. Extended by ${spillDays} day${spillDays === 1 ? "" : "s"} beyond your target date.`
              : `Plan generated with ${result.taskCount ?? 0} tasks using an extended study window.`
          );
        } else {
          toast.success(`Study plan generated! ${result.taskCount ?? 0} tasks created.`);
        }
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

  const todayGroup = groups.find((g) => g.label === "Today");
  const upcomingGroups = groups.filter((g) => g.label !== "Today");

  return (
    <div className="page-wrap page-stack">
      <Link
        href="/today"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Today
      </Link>

      <div className="glass-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title animate-in-up stagger-1">Study Plan</h1>
            <p className="page-subtitle animate-in-up stagger-2">Generate and track a daily study roadmap.</p>
          </div>
          {tasks.length === 0 ? (
            <Button onClick={handleGenerate} disabled={generating || !courseId} size="sm" className="rounded-xl">
              <Plus className="mr-1.5 h-4 w-4" />
              {generating ? "Generating..." : "Generate Plan"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleRegen} disabled={generating}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Regenerating..." : "Regenerate"}
            </Button>
          )}
        </div>

        {tasks.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5 animate-in-up stagger-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={pct}
                  size={56}
                  strokeWidth={5}
                  color="oklch(0.65 0.24 260)"
                  label={`${pct}%`}
                />
                <div>
                  <p className="text-sm font-medium">
                    <NumberTicker value={doneCount} className="font-bold" /> of{" "}
                    <span className="font-bold">{tasks.length}</span> tasks done
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~{Math.round(totalMinutes / 60)}h total study time
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-blue-500" /> {studyCount} study
                </span>
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-violet-500" /> {quizCount} quiz
                </span>
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-amber-500" /> {reviewCount} review
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {(error || taskError) && (
        <div className="break-words rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-in-up">
          {error || taskError}
        </div>
      )}

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
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No study plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload materials first, then your plan generates automatically.
          </p>
          <Link href="/library">
            <Button variant="outline" size="sm" className="mt-4 rounded-xl">
              Go to Library
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {todayGroup && (
            <div className="glass-card p-4 sm:p-5 border-primary/15 animate-in-up">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-base font-semibold">Today</h2>
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground">
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

          {upcomingGroups.map((group, gi) => (
            <div
              key={group.label}
              className="glass-card p-4 sm:p-5"
              style={{ animationDelay: `${gi * 60}ms` }}
            >
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-base font-semibold">{group.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
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
