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
  const remainingMinutes = tasks
    .filter((t) => t.status !== "DONE")
    .reduce((sum, t) => sum + (t.estMinutes ?? 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border/60 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold tracking-tight">Today&rsquo;s Tasks</h2>
            {tasks.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {remainingMinutes > 0 ? `${remainingMinutes}m remaining` : "All done for today"}
              </p>
            )}
          </div>
          {tasks.length > 0 && (
            <Badge
              variant={doneCount === tasks.length ? "default" : "secondary"}
              className={cn(
                "text-[11px] tabular-nums font-semibold",
                doneCount === tasks.length && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 hover:bg-emerald-100"
              )}
            >
              {doneCount}/{tasks.length}
            </Badge>
          )}
        </div>

        {tasks.length > 0 && (
          <Progress value={progressPct} className="mt-2.5 h-1" />
        )}
      </div>

      {/* Task list */}
      <div className="p-2">
        {loading ? (
          <ListLoadingState rows={3} />
        ) : tasks.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">All caught up</p>
              <p className="text-[11px] text-muted-foreground">No remaining tasks for today.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tasks.map((task) => {
              const Icon = typeIcon[task.type] ?? BookOpen;
              const isDone = task.status === "DONE";
              const cleanTitle = resolveTaskBody(task, map);
              const taskTypeLabel = typeLabel[task.type] ?? task.type;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "group flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition-all hover:bg-accent/60",
                    isDone && "opacity-45"
                  )}
                >
                  <button
                    onClick={() => toggleTask(task)}
                    role="checkbox"
                    aria-checked={isDone}
                    className="shrink-0 pt-0.5 transition-transform active:scale-90"
                    aria-label={isDone ? `Mark "${cleanTitle}" as incomplete` : `Mark "${cleanTitle}" as complete`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-[18px] w-[18px] text-primary" />
                    ) : (
                      <Circle className="h-[18px] w-[18px] text-border hover:text-primary transition-colors" />
                    )}
                  </button>

                  <button
                    onClick={() => handleNavigate(task)}
                    className={cn(
                      "min-w-0 flex flex-1 items-start gap-3 text-left",
                      isDone && "text-muted-foreground"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Icon className="h-2.5 w-2.5" />
                          {taskTypeLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                          {task.estMinutes}m
                        </span>
                      </div>
                      <span
                        className={cn(
                          "block text-[13px] leading-relaxed mt-0.5",
                          isDone && "line-through text-muted-foreground",
                          "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                        )}
                      >
                        {cleanTitle}
                      </span>
                    </div>
                    <ChevronRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
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
