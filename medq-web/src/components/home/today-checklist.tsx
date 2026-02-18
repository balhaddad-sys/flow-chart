"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ListLoadingState } from "@/components/ui/loading-state";
import { CheckCircle2, Circle, BookOpen, HelpCircle, RotateCcw, Check, ChevronRight } from "lucide-react";
import { updateTask } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import { resolveTaskBody } from "@/lib/utils/task-title";
import type { TaskModel } from "@/lib/types/task";
import type { SectionModel } from "@/lib/types/section";

interface TodayChecklistProps {
  tasks: TaskModel[];
  loading: boolean;
  sectionMap?: Map<string, SectionModel>;
}

const typeIcon: Record<string, typeof BookOpen> = {
  STUDY: BookOpen,
  QUESTIONS: HelpCircle,
  REVIEW: RotateCcw,
};

const typeColor: Record<string, string> = {
  STUDY: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  QUESTIONS: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  REVIEW: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
};

const typeLabel: Record<string, string> = {
  STUDY: "Study",
  QUESTIONS: "Questions",
  REVIEW: "Review",
};

const EMPTY_MAP = new Map<string, SectionModel>();

export function TodayChecklist({ tasks, loading, sectionMap }: TodayChecklistProps) {
  const map = sectionMap ?? EMPTY_MAP;
  const { uid } = useAuth();
  const router = useRouter();
  const togglingRef = useRef(new Set<string>());

  async function toggleTask(task: TaskModel) {
    if (!uid || togglingRef.current.has(task.id)) return;
    togglingRef.current.add(task.id);
    try {
      const newStatus = task.status === "DONE" ? "TODO" : "DONE";
      await updateTask(uid, task.id, { status: newStatus });
    } finally {
      togglingRef.current.delete(task.id);
    }
  }

  function handleNavigate(task: TaskModel) {
    if (task.type === "QUESTIONS" && task.sectionIds[0]) {
      router.push(`/practice/quiz?section=${task.sectionIds[0]}`);
    } else if (task.sectionIds[0]) {
      router.push(`/study/${task.id}/${task.sectionIds[0]}`);
    }
  }

  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estMinutes ?? 0), 0);
  const remainingMinutes = tasks
    .filter((t) => t.status !== "DONE")
    .reduce((sum, t) => sum + (t.estMinutes ?? 0), 0);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight">Today&rsquo;s Schedule</h2>
              {tasks.length > 0 && (
                <Badge
                  variant={doneCount === tasks.length ? "default" : "secondary"}
                  className={cn(
                    "text-xs tabular-nums shadow-none",
                    doneCount === tasks.length && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                  )}
                >
                  {doneCount}/{tasks.length} done
                </Badge>
              )}
            </div>
            {tasks.length > 0 && (
              <p className="text-[0.75rem] text-muted-foreground">
                {remainingMinutes > 0
                  ? `${remainingMinutes}m remaining · ${totalMinutes}m total`
                  : `All ${totalMinutes}m complete`}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <Progress
              value={progressPct}
              className="h-1.5"
            />
            <p className="text-right text-[0.6875rem] font-medium text-muted-foreground tabular-nums">
              {progressPct}%
            </p>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="p-3">
        {loading ? (
          <ListLoadingState rows={3} />
        ) : tasks.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-5 py-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All caught up for today</p>
              <p className="mt-0.5 text-xs text-muted-foreground">No remaining tasks — great work.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task, i) => {
              const Icon = typeIcon[task.type] ?? BookOpen;
              const isDone = task.status === "DONE";
              const cleanTitle = resolveTaskBody(task, map);
              const taskTypeLabel = typeLabel[task.type] ?? task.type;
              const typeTone = typeColor[task.type] ?? "";
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3 transition-all duration-200 hover:bg-accent/40 hover:border-primary/15",
                    isDone && "opacity-55"
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task)}
                    className="shrink-0 pt-0.5 transition-transform active:scale-90"
                    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-[1.125rem] w-[1.125rem] text-emerald-500" />
                    ) : (
                      <Circle className="h-[1.125rem] w-[1.125rem] text-muted-foreground/60 hover:text-primary transition-colors" />
                    )}
                  </button>

                  {/* Content */}
                  <button
                    onClick={() => handleNavigate(task)}
                    className={cn(
                      "min-w-0 flex flex-1 items-start gap-3 text-left",
                      isDone && "text-muted-foreground"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Type pill + duration */}
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                          typeTone
                        )}>
                          <Icon className="h-3 w-3" />
                          {taskTypeLabel}
                        </span>
                        <span className="text-[0.6875rem] font-medium text-muted-foreground tabular-nums">
                          {task.estMinutes}m
                        </span>
                      </div>

                      {/* Title */}
                      <span
                        className={cn(
                          "block text-[0.8125rem] leading-relaxed text-foreground/85",
                          isDone && "line-through text-muted-foreground",
                          "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                        )}
                      >
                        {cleanTitle}
                      </span>
                    </div>

                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
