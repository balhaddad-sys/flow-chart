"use client";

import type { StatsModel } from "@/lib/types/stats";
import { NumberTicker } from "@/components/ui/animate-in";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StreakDisplay } from "@/components/ui/streak-display";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

interface StatsCardsProps {
  stats: StatsModel | null;
  loading?: boolean;
}

export function StatsCards({ stats, loading = false }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="metric-card space-y-4">
            <Skeleton className="h-3 w-2/5 rounded-full" />
            <Skeleton className="h-9 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const totalHours = stats ? Math.round(stats.totalStudyMinutes / 60) : 0;
  const totalMins  = stats ? stats.totalStudyMinutes % 60 : 0;
  const accuracy   = stats ? Math.round(stats.overallAccuracy * 100) : 0;
  const completion = stats ? Math.round(stats.completionPercent * 100) : 0;
  const streakDays = stats?.streakDays ?? 0;
  const answered   = stats?.totalQuestionsAnswered ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

      {/* Study Time */}
      <div className="metric-card animate-in-up stagger-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/12">
            <Clock className="h-[1.0625rem] w-[1.0625rem] text-sky-500" />
          </div>
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Study Time
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <NumberTicker value={totalHours} className="stat-number" />
            <span className="text-base font-semibold text-muted-foreground">h</span>
            {totalMins > 0 && (
              <>
                <NumberTicker value={totalMins} className="stat-number" />
                <span className="text-base font-semibold text-muted-foreground">m</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            Total logged this course
          </p>
        </div>
      </div>

      {/* Accuracy */}
      <div className="metric-card animate-in-up stagger-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ProgressRing
            value={accuracy}
            size={36}
            strokeWidth={3.5}
            color="oklch(0.65 0.19 155)"
          />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Accuracy
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <NumberTicker value={accuracy} className="stat-number" />
            <span className="text-base font-semibold text-muted-foreground">%</span>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            {answered > 0 ? `Across ${answered.toLocaleString()} questions` : "No attempts yet"}
          </p>
        </div>
      </div>

      {/* Completion */}
      <div className="metric-card animate-in-up stagger-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <ProgressRing
            value={completion}
            size={36}
            strokeWidth={3.5}
            color="oklch(0.65 0.19 270)"
          />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Completion
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <NumberTicker value={completion} className="stat-number" />
            <span className="text-base font-semibold text-muted-foreground">%</span>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            {completion >= 100 ? "Course complete" : `${100 - completion}% remaining`}
          </p>
        </div>
      </div>

      {/* Streak */}
      <StreakDisplay
        days={streakDays}
        lastStudied={stats?.lastStudiedAt?.toDate?.() ?? null}
        className="animate-in-up stagger-4"
      />
    </div>
  );
}
