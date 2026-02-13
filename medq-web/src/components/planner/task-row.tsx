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
    <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50">
      <button onClick={toggleDone} className="shrink-0" aria-label="Toggle done">
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <button
        onClick={handleNavigate}
        className={`flex flex-1 items-center gap-2 text-left text-sm ${isDone || isSkipped ? "text-muted-foreground line-through" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{task.title}</span>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {task.isPinned && <Pin className="h-3.5 w-3.5 text-primary" />}
        {task.isFixPlan && (
          <Badge variant="secondary" className="text-xs">Fix</Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {typeLabel[task.type] ?? task.type}
        </Badge>
        <span className="text-xs text-muted-foreground">{task.estMinutes}m</span>
      </div>
    </div>
  );
}
