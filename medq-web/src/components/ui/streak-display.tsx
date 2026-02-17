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

    // Simple heuristic: mark days as active if they're within the streak range
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
    <div className={cn("metric-card relative overflow-hidden", className)}>
      <div className="flex items-center gap-3">
        {/* Flame icon */}
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            isActive
              ? "bg-gradient-to-br from-orange-400/20 to-amber-500/20"
              : "bg-muted/60"
          )}
        >
          <Flame
            className={cn(
              "h-6 w-6",
              isActive
                ? "text-orange-500 animate-streak-glow"
                : "text-muted-foreground"
            )}
          />
        </div>

        {/* Counter */}
        <div>
          <div className="flex items-baseline gap-1">
            <NumberTicker
              value={days}
              className="text-2xl font-bold tracking-tight"
            />
            <span className="text-sm font-medium text-muted-foreground">day streak</span>
          </div>
          {atRisk && (
            <p className="text-[11px] font-medium text-orange-500">
              Study today to keep your streak!
            </p>
          )}
        </div>
      </div>

      {/* 7-day calendar */}
      <div className="mt-3 flex items-center gap-1.5">
        {dots.map((active, i) => {
          const isToday = i === 6;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground/70 font-medium">
                {DAY_LABELS[i]}
              </span>
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  active
                    ? "bg-orange-500"
                    : isToday && atRisk
                    ? "border-2 border-orange-400/60 bg-transparent"
                    : "bg-muted-foreground/20"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
