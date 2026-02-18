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

  const statusLabel = isUrgent ? "Urgent" : isWarning ? "Approaching" : "Scheduled";

  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4 text-center shadow-sm min-w-[9rem]",
        isUrgent
          ? "border-red-500/35 bg-red-500/8 animate-glow-pulse"
          : isWarning
          ? "border-orange-500/30 bg-orange-500/7"
          : "border-border/70 bg-card/70"
      )}
    >
      <div className={cn(
        "mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full",
        isUrgent ? "bg-red-500/15" : isWarning ? "bg-orange-500/12" : "bg-muted/80"
      )}>
        <CalendarClock
          className={cn(
            "h-4 w-4",
            isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-muted-foreground"
          )}
        />
      </div>

      <div className="flex items-baseline justify-center gap-1">
        <NumberTicker
          value={isPassed ? 0 : daysLeft}
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-foreground"
          )}
        />
        <span className={cn(
          "text-sm font-semibold",
          isUrgent ? "text-red-500/80" : isWarning ? "text-orange-500/80" : "text-muted-foreground"
        )}>
          {daysLeft === 1 ? "day" : "days"}
        </span>
      </div>

      <p className={cn(
        "mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em]",
        isUrgent ? "text-red-500/70" : isWarning ? "text-orange-500/70" : "text-muted-foreground/70"
      )}>
        {statusLabel}
      </p>

      <div className="mt-2.5 border-t border-border/40 pt-2.5">
        <p className="text-[0.6875rem] text-muted-foreground">{dateStr}</p>
      </div>
    </div>
  );
}
