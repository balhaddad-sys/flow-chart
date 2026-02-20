"use client";

import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/ui/animate-in";
import { Flame } from "lucide-react";

interface StreakDisplayProps {
  days: number;
  lastStudied?: Date | null;
  className?: string;
}

function getDayDots(lastStudied: Date | null | undefined): boolean[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dots: boolean[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    if (!lastStudied) {
      dots.push(false);
      continue;
    }

    const last = new Date(lastStudied);
    last.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));
    dots.push(diffDays < (lastStudied ? 7 : 0) && day <= last);
  }

  return dots;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function StreakDisplay({ days, lastStudied, className }: StreakDisplayProps) {
  const dots = getDayDots(lastStudied);
  const isActive = days > 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const studiedToday = lastStudied
    ? new Date(lastStudied).setHours(0, 0, 0, 0) === today.getTime()
    : false;

  const atRisk = isActive && !studiedToday;

  return (
    <div className={cn("metric-card", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Streak</p>
      <div className="mt-2 flex items-center gap-2">
        <Flame
          className={cn(
            "h-5 w-5",
            isActive ? "text-orange-500 animate-streak-glow" : "text-muted-foreground/40"
          )}
        />
        <div className="flex items-baseline gap-0.5">
          <NumberTicker value={days} className="text-xl font-bold tracking-tight" />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1">
        {dots.map((active, i) => {
          const isToday = i === 6;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
              <span className="text-[8px] text-muted-foreground/60 font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={cn(
                  "h-2 w-full rounded-sm transition-colors",
                  active
                    ? "bg-orange-500"
                    : isToday && atRisk
                    ? "bg-orange-200 dark:bg-orange-500/30"
                    : "bg-muted"
                )}
              />
            </div>
          );
        })}
      </div>

      {atRisk && (
        <p className="mt-1.5 text-[10px] font-medium text-orange-500">Study today to keep it</p>
      )}
    </div>
  );
}
