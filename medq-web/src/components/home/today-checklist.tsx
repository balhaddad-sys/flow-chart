"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, BookOpen, HelpCircle, RotateCcw, Check } from "lucide-react";
import { updateTask } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import type { TaskModel } from "@/lib/types/task";

interface TodayChecklistProps {
  tasks: TaskModel[];
  loading: boolean;
}

const typeIcon: Record<string, typeof BookOpen> = {
  STUDY: BookOpen,
  QUESTIONS: HelpCircle,
  REVIEW: RotateCcw,
};

const typeColor: Record<string, string> = {
  STUDY: "bg-blue-500/10 text-blue-600",
  QUESTIONS: "bg-green-500/10 text-green-600",
  REVIEW: "bg-purple-500/10 text-purple-600",
};

export function TodayChecklist({ tasks, loading }: TodayChecklistProps) {
  const { uid } = useAuth();
  const router = useRouter();

  async function toggleTask(task: TaskModel) {
    if (!uid) return;
    const newStatus = task.status === "DONE" ? "TODO" : "DONE";
    await updateTask(uid, task.id, { status: newStatus });
  }

  function handleNavigate(task: TaskModel) {
    if (task.type === "QUESTIONS" && task.sectionIds[0]) {
      router.push(`/quiz?section=${task.sectionIds[0]}`);
    } else if (task.sectionIds[0]) {
      router.push(`/study/${task.id}/${task.sectionIds[0]}`);
    }
  }

  const doneCount = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Today</h2>
        {tasks.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {doneCount}/{tasks.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Check className="h-4 w-4" />
          All caught up for today.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const Icon = typeIcon[task.type] ?? BookOpen;
            const isDone = task.status === "DONE";
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50"
              >
                <button
                  onClick={() => toggleTask(task)}
                  className="shrink-0"
                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleNavigate(task)}
                  className={`flex flex-1 items-center gap-2 text-left text-sm ${isDone ? "text-muted-foreground line-through" : ""}`}
                >
                  <span className={`rounded p-1 ${typeColor[task.type] ?? ""}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 truncate">{task.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {task.estMinutes}m
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
