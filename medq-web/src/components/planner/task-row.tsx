"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, BookOpen, HelpCircle, RotateCcw, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { updateTask } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import type { TaskModel } from "@/lib/types/task";

interface TaskRowProps {
  task: TaskModel;
}

const typeIcon: Record<string, typeof BookOpen> = {
  STUDY: BookOpen,
  QUESTIONS: HelpCircle,
  REVIEW: RotateCcw,
};

const typeLabel: Record<string, string> = {
  STUDY: "Study",
  QUESTIONS: "Quiz",
  REVIEW: "Review",
};

export function TaskRow({ task }: TaskRowProps) {
  const { uid } = useAuth();
  const router = useRouter();
  const isDone = task.status === "DONE";
  const isSkipped = task.status === "SKIPPED";
  const Icon = typeIcon[task.type] ?? BookOpen;

  async function toggleDone() {
    if (!uid) return;
    const newStatus = isDone ? "TODO" : "DONE";
    await updateTask(uid, task.id, { status: newStatus });
  }

  function handleNavigate() {
    if (task.type === "QUESTIONS" && task.sectionIds[0]) {
      router.push(`/quiz?section=${task.sectionIds[0]}`);
    } else if (task.sectionIds[0]) {
      router.push(`/study/${task.id}/${task.sectionIds[0]}`);
    }
  }

  return (
    <div className="rounded-lg border p-3 transition-colors hover:bg-accent/50">
      <div className="flex items-start gap-3">
        <button onClick={toggleDone} className="shrink-0 mt-0.5" aria-label="Toggle done">
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={handleNavigate}
          className={`flex-1 min-w-0 text-left text-sm ${isDone || isSkipped ? "text-muted-foreground line-through" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{task.title}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {task.isPinned && <Pin className="h-3 w-3 text-primary" />}
            {task.isFixPlan && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0">Fix</Badge>
            )}
            <Badge variant="outline" className="text-[11px] px-1.5 py-0">
              {typeLabel[task.type] ?? task.type}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{task.estMinutes}m</span>
          </div>
        </button>
      </div>
    </div>
  );
}
