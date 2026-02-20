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
      <div className="flex items-center gap-3">
        <Flame
          className={cn(
            "h-5 w-5",
            isActive ? "text-orange-500" : "text-muted-foreground"
          )}
        />
        <div>
          <div className="flex items-baseline gap-1">
            <NumberTicker value={days} className="text-2xl font-semibold tracking-tight" />
            <span className="text-sm text-muted-foreground">day streak</span>
          </div>
          {atRisk && (
            <p className="text-xs text-orange-500">Study today to keep your streak</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {dots.map((active, i) => {
          const isToday = i === 6;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  active
                    ? "bg-orange-500"
                    : isToday && atRisk
                    ? "border-2 border-orange-400/60 bg-transparent"
                    : "bg-muted"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
