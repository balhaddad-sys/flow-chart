"use client";

import type { StatsModel } from "@/lib/types/stats";

interface StatsCardsProps {
  stats: StatsModel | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const completionPct = stats ? Math.round(stats.completionPercent * 100) : 0;
  const totalHours = stats ? Math.round(stats.totalStudyMinutes / 60) : 0;

  const items = [
    { label: "Study Time", value: `${totalHours}h`, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
    { label: "Accuracy", value: stats ? `${Math.round(stats.overallAccuracy * 100)}%` : "--", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    { label: "Completion", value: `${completionPct}%`, tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
    { label: "Streak", value: `${stats?.streakDays ?? 0}d`, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="metric-card">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${item.tone}`}>
            {item.label}
          </span>
          <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{item.value}</p>
          <p className="text-xs text-muted-foreground">Current snapshot</p>
        </div>
      ))}
    </div>
  );
}
