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
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const isUrgent  = daysLeft <= 7;
  const isWarning = daysLeft > 7 && daysLeft <= 30;
  const isPassed  = daysLeft === 0;

  const dateStr = exam.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 text-center min-w-[8rem]",
        isUrgent
          ? "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
          : isWarning
          ? "border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10"
          : "border-border bg-card"
      )}
    >
      <CalendarClock
        className={cn(
          "mx-auto h-4 w-4 mb-2",
          isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-muted-foreground"
        )}
      />

      <div className="flex items-baseline justify-center gap-1">
        <NumberTicker
          value={isPassed ? 0 : daysLeft}
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight",
            isUrgent ? "text-red-600 dark:text-red-400" : isWarning ? "text-orange-600 dark:text-orange-400" : "text-foreground"
          )}
        />
        <span className="text-sm text-muted-foreground">
          {daysLeft === 1 ? "day" : "days"}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
    </div>
  );
}
