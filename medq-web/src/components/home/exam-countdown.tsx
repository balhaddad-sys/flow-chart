"use client";

import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/ui/animate-in";
import { Timer } from "lucide-react";

interface ExamCountdownProps {
  examDate?: Timestamp;
  courseTitle?: string;
}

export function ExamCountdown({ examDate }: ExamCountdownProps) {
  if (!examDate) return null;

  const exam = examDate.toDate();
  const now = new Date();
  const diffMs = exam.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const isUrgent = daysLeft <= 7;
  const isWarning = daysLeft > 7 && daysLeft <= 30;

  const dateStr = exam.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 shadow-sm",
        isUrgent
          ? "border-red-500/30 bg-red-500/8 animate-glow-pulse"
          : isWarning
          ? "border-orange-500/30 bg-orange-500/8"
          : "border-border/70 bg-card/70"
      )}
    >
      <Timer
        className={cn(
          "h-4 w-4",
          isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-muted-foreground"
        )}
      />
      <div className="flex items-baseline gap-1.5">
        <NumberTicker
          value={daysLeft}
          className={cn(
            "text-lg font-bold tabular-nums",
            isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-foreground"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {daysLeft === 1 ? "day" : "days"} left
        </span>
      </div>
      <span className="text-xs text-muted-foreground/60">·</span>
      <span className="text-xs text-muted-foreground">{dateStr}</span>
    </div>
  );
}
