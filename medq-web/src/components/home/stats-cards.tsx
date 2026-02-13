"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Target, Clock, Flame } from "lucide-react";
import type { StatsModel } from "@/lib/types/stats";

interface StatsCardsProps {
  stats: StatsModel | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Study Time",
      value: stats ? `${Math.round(stats.totalStudyMinutes / 60)}h` : "0h",
      sub: stats ? `${stats.weeklyStudyMinutes}m this week` : "No data yet",
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Questions",
      value: stats?.totalQuestionsAnswered?.toString() ?? "0",
      sub: stats ? `${Math.round(stats.overallAccuracy * 100)}% accuracy` : "No data yet",
      icon: Target,
      color: "text-green-500",
    },
    {
      label: "Completion",
      value: stats ? `${Math.round(stats.completionPercent)}%` : "0%",
      sub: "of course content",
      icon: BookOpen,
      color: "text-purple-500",
    },
    {
      label: "Streak",
      value: stats?.streakDays?.toString() ?? "0",
      sub: stats?.streakDays === 1 ? "day" : "days",
      icon: Flame,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className={`rounded-lg bg-muted p-2 ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
