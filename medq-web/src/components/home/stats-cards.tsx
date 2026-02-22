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
  error?: string | null;
}

export function StatsCards({ stats, loading = false, error = null }: StatsCardsProps) {
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Stats will refresh automatically.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-4 space-y-2.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-7 w-3/5" />
            <Skeleton className="h-2.5 w-4/5" />
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
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">

      {/* Study Time */}
      <div className="metric-card">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Study Time</p>
        <div className="mt-2 flex items-baseline gap-0.5">
          <NumberTicker value={totalHours} className="text-xl font-bold tabular-nums tracking-tight" />
          <span className="text-xs text-muted-foreground">h</span>
          {totalMins > 0 && (
            <>
              <NumberTicker value={totalMins} className="text-xl font-bold tabular-nums tracking-tight" />
              <span className="text-xs text-muted-foreground">m</span>
            </>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground">This course</span>
        </div>
      </div>

      {/* Accuracy */}
      <div className="metric-card">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Accuracy</p>
        <div className="mt-2 flex items-center gap-2.5">
          <ProgressRing value={accuracy} size={36} strokeWidth={3.5} color="var(--primary)" />
          <div className="flex items-baseline gap-0.5">
            <NumberTicker value={accuracy} className="text-xl font-bold tabular-nums tracking-tight" />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {answered > 0 ? `${answered.toLocaleString()} Qs` : "No attempts"}
        </p>
      </div>

      {/* Completion */}
      <div className="metric-card">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Completion</p>
        <div className="mt-2 flex items-center gap-2.5">
          <ProgressRing value={completion} size={36} strokeWidth={3.5} color="#7c3aed" />
          <div className="flex items-baseline gap-0.5">
            <NumberTicker value={completion} className="text-xl font-bold tabular-nums tracking-tight" />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {completion >= 100 ? "Complete" : `${100 - completion}% left`}
        </p>
      </div>

      {/* Streak */}
      <StreakDisplay
        days={streakDays}
        lastStudied={stats?.lastStudiedAt?.toDate?.() ?? null}
      />
    </div>
  );
}
