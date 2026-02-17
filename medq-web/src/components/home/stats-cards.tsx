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
          <div key={index} className="metric-card space-y-3">
            <Skeleton className="h-4 w-2/5 rounded-full" />
            <Skeleton className="h-7 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const totalHours = stats ? Math.round(stats.totalStudyMinutes / 60) : 0;
  const accuracy = stats ? Math.round(stats.overallAccuracy * 100) : 0;
  const completion = stats ? Math.round(stats.completionPercent * 100) : 0;
  const streakDays = stats?.streakDays ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Study Time */}
      <div className="metric-card animate-in-up stagger-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12">
            <Clock className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Study Time</p>
            <div className="flex items-baseline gap-1">
              <NumberTicker value={totalHours} className="text-2xl font-bold tabular-nums" />
              <span className="text-sm text-muted-foreground">hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy */}
      <div className="metric-card animate-in-up stagger-2">
        <div className="flex items-center gap-3">
          <ProgressRing
            value={accuracy}
            size={40}
            strokeWidth={4}
            color="oklch(0.65 0.19 155)"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Accuracy</p>
            <div className="flex items-baseline gap-1">
              <NumberTicker value={accuracy} className="text-2xl font-bold tabular-nums" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Completion */}
      <div className="metric-card animate-in-up stagger-3">
        <div className="flex items-center gap-3">
          <ProgressRing
            value={completion}
            size={40}
            strokeWidth={4}
            color="oklch(0.65 0.19 270)"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Completion</p>
            <div className="flex items-baseline gap-1">
              <NumberTicker value={completion} className="text-2xl font-bold tabular-nums" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
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
