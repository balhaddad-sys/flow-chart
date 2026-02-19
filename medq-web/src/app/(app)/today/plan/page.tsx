"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useTasks } from "@/lib/hooks/useTasks";
import { useSections } from "@/lib/hooks/useSections";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { groupTasksByDay } from "@/lib/utils/date";
import { buildSectionMap } from "@/lib/utils/task-title";
import { TaskRow } from "@/components/planner/task-row";
import { Button } from "@/components/ui/button";
import { LoadingButtonLabel, SectionLoadingState } from "@/components/ui/loading-state";
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
  FileText,
  Brain,
  ClipboardList,
} from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";
import type { TaskModel } from "@/lib/types/task";
import type { SectionModel } from "@/lib/types/section";

/** Map of task type to icon, color, and label for section headers */
const TASK_TYPE_CONFIG = {
  STUDY: { icon: BookOpen, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "Study Session" },
  QUESTIONS: { icon: Brain, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", label: "Practice Questions" },
  REVIEW: { icon: RotateCcw, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Review Session" },
} as const;

function PlanSectionHeader({
  task,
  sectionMap,
}: {
  task: TaskModel;
  sectionMap: Map<string, SectionModel>;
}) {
  const config = TASK_TYPE_CONFIG[task.type as keyof typeof TASK_TYPE_CONFIG] || TASK_TYPE_CONFIG.STUDY;
  const Icon = config.icon;

  // Get specific section details for context-rich headers
  const primarySection = task.sectionIds?.[0] ? sectionMap.get(task.sectionIds[0]) : null;
  const sectionTitle = primarySection?.title || task.title;
  const topicTags = task.topicTags?.length ? task.topicTags : primarySection?.topicTags;
  const difficulty = primarySection?.difficulty;
  const estMinutes = task.estMinutes;

  return (
    <div className="section-header">
      <div className={`section-header-icon ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="section-header-title truncate">{sectionTitle}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <span className="section-header-subtitle">{config.label}</span>
          {estMinutes > 0 && (
            <span className="section-header-subtitle">· {estMinutes}min</span>
          )}
          {difficulty != null && difficulty > 0 && (
            <span className="section-header-subtitle">· Difficulty {difficulty}/5</span>
          )}
        </div>
        {topicTags && topicTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {topicTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {topicTags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{topicTags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { courses } = useCourses();
  const activeCourse = courses.find((c) => c.id === courseId);
  const { tasks, loading, error: taskError } = useTasks(courseId);
  const { sections, loading: sectionsLoading } = useSections(courseId);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoGenTriggered = useRef(false);

  const sectionMap = useMemo(() => buildSectionMap(sections), [sections]);

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
      {/* Back link */}
      <Link
        href="/today"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Today
      </Link>

      {/* Header */}
      <div className="glass-card p-5 sm:p-6 animate-in-up">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Study Plan</h1>
            <p className="page-subtitle">Generate and track a daily study roadmap.</p>
          </div>
          {tasks.length === 0 ? (
            <Button onClick={handleGenerate} disabled={generating || !courseId} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              {generating ? "Generating plan..." : "Generate Plan"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRegen} disabled={generating}>
              {generating ? (
                <LoadingButtonLabel label="Regenerating..." />
              ) : (
                <>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          )}
        </div>

        {/* Summary stats */}
        {tasks.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4 animate-in-up stagger-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={pct}
                  size={48}
                  strokeWidth={4}
                  color="oklch(0.52 0.12 220)"
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
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

      {/* Error */}
      {(error || taskError) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || taskError}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <SectionLoadingState
          title="Loading study plan"
          description="Building your day-by-day tasks."
          rows={4}
        />
      ) : tasks.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No study plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload materials first, then your plan generates automatically.
          </p>
          <Link href="/library">
            <Button variant="outline" size="sm" className="mt-4">
              Go to Library
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Today's tasks */}
          {todayGroup && (
            <div className="glass-card p-4 sm:p-5 animate-in-up">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Today</h2>
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {todayGroup.tasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {todayGroup.tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-background p-3">
                    <PlanSectionHeader task={task} sectionMap={sectionMap} />
                    <TaskRow task={task} sectionMap={sectionMap} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming tasks grouped by day */}
          {upcomingGroups.map((group, gi) => (
            <div
              key={group.label}
              className="glass-card p-4 sm:p-5 animate-in-up"
              style={{ animationDelay: `${gi * 50}ms` }}
            >
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold">{group.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.tasks.length} task{group.tasks.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {group.tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-background p-3">
                    <PlanSectionHeader task={task} sectionMap={sectionMap} />
                    <TaskRow task={task} sectionMap={sectionMap} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
