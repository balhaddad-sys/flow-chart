"use client";

import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/ui/animate-in";
import { CalendarClock } from "lucide-react";

interface ExamCountdownProps {
  examDate?: Timestamp;
  courseTitle?: string;
}

export function ExamCountdown({ examDate }: ExamCountdownProps) {
  if (!examDate) return null;

  const exam = examDate.toDate();
  const now = new Date();
  const diffMs = exam.getTime() - now.getTime();
  const rawDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, rawDays);
  const isPassed = rawDays <= 0;

  const isUrgent  = !isPassed && daysLeft <= 7;
  const isWarning = !isPassed && daysLeft > 7 && daysLeft <= 30;

  const dateStr = exam.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-xl px-5 py-4 text-center min-w-[8rem] transition-colors",
        isPassed
          ? "bg-muted/50 ring-1 ring-border"
          : isUrgent
          ? "bg-red-50 dark:bg-red-500/10 ring-1 ring-red-200 dark:ring-red-500/20"
          : isWarning
          ? "bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20"
          : "bg-muted/50"
      )}
    >
      <CalendarClock
        className={cn(
          "mx-auto h-4 w-4 mb-1.5",
          isPassed ? "text-muted-foreground" : isUrgent ? "text-red-500" : isWarning ? "text-amber-500" : "text-muted-foreground"
        )}
      />

      {isPassed ? (
        <p className="text-sm font-semibold text-muted-foreground">Exam passed</p>
      ) : (
        <div className="flex items-baseline justify-center gap-0.5">
          <NumberTicker
            value={daysLeft}
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              isUrgent ? "text-red-600 dark:text-red-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            )}
          />
          <span className="text-xs text-muted-foreground">
            {daysLeft === 1 ? "day" : "days"}
          </span>
        </div>
      )}

      <p className="mt-0.5 text-[11px] text-muted-foreground">{dateStr}</p>
      {isUrgent && (
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500 animate-glow-pulse">
          Exam soon
        </p>
      )}
    </div>
  );
}
