"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, BookOpen, HelpCircle, RotateCcw, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { updateTask } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { resolveTaskTitle } from "@/lib/utils/task-title";
import type { TaskModel } from "@/lib/types/task";
import type { SectionModel } from "@/lib/types/section";

interface TaskRowProps {
  task: TaskModel;
  sectionMap?: Map<string, SectionModel>;
}

const typeMeta: Record<string, { icon: typeof BookOpen; label: string; color: string }> = {
  STUDY: { icon: BookOpen, label: "Study", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  QUESTIONS: { icon: HelpCircle, label: "Quiz", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEW: { icon: RotateCcw, label: "Review", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export function TaskRow({ task, sectionMap }: TaskRowProps) {
  const { uid } = useAuth();
  const router = useRouter();
  const isDone = task.status === "DONE";
  const isSkipped = task.status === "SKIPPED";
  const meta = typeMeta[task.type] ?? typeMeta.STUDY;
  const Icon = meta.icon;
  const displayTitle = sectionMap ? resolveTaskTitle(task, sectionMap) : task.title;

  async function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) return;
    await updateTask(uid, task.id, { status: isDone ? "TODO" : "DONE" });
  }

  function handleNavigate() {
    if (task.type === "QUESTIONS" && task.sectionIds[0]) {
      router.push(`/practice/quiz?section=${task.sectionIds[0]}`);
    } else if (task.sectionIds[0]) {
      router.push(`/study/${task.id}/${task.sectionIds[0]}`);
    }
  }

  return (
    <button
      onClick={handleNavigate}
      className={`group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/75 p-3.5 text-left transition-all hover:bg-accent/40 hover:shadow-[0_12px_24px_-20px_rgba(15,23,42,0.8)] ${
        isDone ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggleDone}
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? `Mark "${displayTitle}" as incomplete` : `Mark "${displayTitle}" as complete`}
        className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-accent"
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40" />
        )}
      </button>

      <div className={`shrink-0 rounded-lg p-1.5 ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`break-words text-sm font-medium leading-tight ${isDone || isSkipped ? "line-through text-muted-foreground" : ""}`}>
          {displayTitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.estMinutes}m
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            {meta.label}
          </Badge>
          {task.isFixPlan && (
            <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0 text-[10px] px-1.5 py-0 font-normal">
              Fix
            </Badge>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
