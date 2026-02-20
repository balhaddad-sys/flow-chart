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
          <div key={index} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
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
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Study Time</span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <NumberTicker value={totalHours} className="text-2xl font-semibold tabular-nums tracking-tight" />
            <span className="text-sm text-muted-foreground">h</span>
            {totalMins > 0 && (
              <>
                <NumberTicker value={totalMins} className="text-2xl font-semibold tabular-nums tracking-tight" />
                <span className="text-sm text-muted-foreground">m</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Total this course</p>
        </div>
      </div>

      {/* Accuracy */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <ProgressRing value={accuracy} size={32} strokeWidth={3} color="#2563eb" />
          <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-0.5">
            <NumberTicker value={accuracy} className="text-2xl font-semibold tabular-nums tracking-tight" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {answered > 0 ? `${answered.toLocaleString()} questions` : "No attempts yet"}
          </p>
        </div>
      </div>

      {/* Completion */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <ProgressRing value={completion} size={32} strokeWidth={3} color="#8b5cf6" />
          <span className="text-xs font-medium text-muted-foreground">Completion</span>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-0.5">
            <NumberTicker value={completion} className="text-2xl font-semibold tabular-nums tracking-tight" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {completion >= 100 ? "Course complete" : `${100 - completion}% remaining`}
          </p>
        </div>
      </div>

      {/* Streak */}
      <StreakDisplay
        days={streakDays}
        lastStudied={stats?.lastStudiedAt?.toDate?.() ?? null}
      />
    </div>
  );
}
