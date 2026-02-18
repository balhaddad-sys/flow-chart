"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ListLoadingState } from "@/components/ui/loading-state";
import { CheckCircle2, Circle, BookOpen, HelpCircle, RotateCcw, Check } from "lucide-react";
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
  STUDY: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  QUESTIONS: "bg-green-500/10 text-green-600 dark:text-green-400",
  REVIEW: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
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

  return (
    <div className="glass-card space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Today</h2>
        {tasks.length > 0 && (
          <Badge variant="secondary" className="text-xs shadow-none tabular-nums">
            {doneCount}/{tasks.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <ListLoadingState rows={3} />
      ) : tasks.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" />
          All caught up for today.
        </div>
      ) : (
        <div className="space-y-2">
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
                  "flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3.5 transition-all duration-200 hover:bg-accent/45 hover:border-primary/15",
                  isDone && "opacity-60"
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="shrink-0 pt-1 transition-transform active:scale-90"
                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <button
                  onClick={() => handleNavigate(task)}
                  className={cn(
                    "min-w-0 flex flex-1 flex-col items-start gap-2 text-left",
                    isDone && "text-muted-foreground"
                  )}
                >
                  <div className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                      typeTone
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                      {taskTypeLabel}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                      {task.estMinutes}m
                    </span>
                  </div>
                  <span
                    className={cn(
                      "min-w-0 text-sm leading-relaxed text-foreground/85",
                      isDone && "line-through text-muted-foreground",
                      "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                    )}
                  >
                    {cleanTitle}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
