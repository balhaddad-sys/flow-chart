"use client";

import type { StatsModel } from "@/lib/types/stats";

interface StatsCardsProps {
  stats: StatsModel | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const completionPct = stats ? Math.round(stats.completionPercent * 100) : 0;
  const totalHours = stats ? Math.round(stats.totalStudyMinutes / 60) : 0;

  const items = [
    { label: "Study Time", value: `${totalHours}h` },
    { label: "Accuracy", value: stats ? `${Math.round(stats.overallAccuracy * 100)}%` : "--" },
    { label: "Completion", value: `${completionPct}%` },
    { label: "Streak", value: `${stats?.streakDays ?? 0}d` },
  ];

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={i > 0 ? "md:border-l md:pl-6 border-border" : ""}
        >
          <p className="text-xl font-bold tabular-nums sm:text-2xl">{item.value}</p>
          <p className="text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
