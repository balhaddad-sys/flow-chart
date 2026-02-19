"use client";

import { useMemo } from "react";
import { useStats } from "@/lib/hooks/useStats";
import { useTasks } from "@/lib/hooks/useTasks";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const COLORS = [
  "oklch(0.65 0.20 260)",
  "oklch(0.70 0.18 155)",
  "oklch(0.75 0.16 85)",
  "oklch(0.60 0.22 30)",
  "oklch(0.65 0.20 300)",
  "oklch(0.70 0.16 340)",
];

const tooltipStyle = {
  fontSize: "12px",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--card)",
  boxShadow: "0 4px 12px -2px rgba(0,0,0,0.12)",
};

interface AnalyticsChartsProps {
  courseId: string | null;
}

export function AnalyticsCharts({ courseId }: AnalyticsChartsProps) {
  const { stats, loading: statsLoading } = useStats(courseId);
  const { tasks, loading: tasksLoading } = useTasks(courseId);
  const dataLoading = statsLoading || tasksLoading;

  const taskBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.type] = (counts[t.type] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const statusData = useMemo(() => {
    const counts = { DONE: 0, TODO: 0, IN_PROGRESS: 0, SKIPPED: 0 };
    for (const t of tasks) {
      const key = t.status as keyof typeof counts;
      if (key in counts) counts[key]++;
    }
    return [
      { name: "Done", value: counts.DONE },
      { name: "To Do", value: counts.TODO },
      { name: "In Progress", value: counts.IN_PROGRESS },
      { name: "Skipped", value: counts.SKIPPED },
    ].filter((d) => d.value > 0);
  }, [tasks]);

  const weeklyMinutes = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = new Array(7).fill(0);
    for (const t of tasks) {
      if (t.status === "DONE" && t.actualMinutes && t.dueDate) {
        const dayIndex = t.dueDate.toDate().getDay();
        totals[dayIndex] += t.actualMinutes;
      }
    }
    return days.map((name, i) => ({ name, minutes: totals[i] }));
  }, [tasks]);

  const radarData = useMemo(() => {
    if (!stats?.weakestTopics) return [];
    return stats.weakestTopics.slice(0, 6).map((topic) => ({
      subject: topic.tag.length > 12 ? topic.tag.slice(0, 12) + "..." : topic.tag,
      accuracy: Math.round(topic.accuracy * 100),
    }));
  }, [stats]);

  if (dataLoading) {
    return (
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card overflow-hidden rounded-2xl">
            <div className="border-b border-border/50 px-5 py-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 h-3 w-48 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="flex items-center justify-center p-5" style={{ height: 220 }}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
      {/* Study Time by Day */}
      <div className="glass-card overflow-hidden rounded-2xl animate-in-up stagger-1">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Study Time by Day</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Minutes spent studying each day of the week.</p>
        </div>
        <div className="p-5">
          {weeklyMinutes.some((d) => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyMinutes}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" width={30} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}m`, "Minutes"]} />
                <Bar dataKey="minutes" fill="oklch(0.65 0.24 260)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Complete some tasks to see your study time breakdown.
            </p>
          )}
        </div>
      </div>

      {/* Task Status */}
      <div className="glass-card overflow-hidden rounded-2xl animate-in-up stagger-2">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Task Status</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Breakdown of your task completion status.</p>
        </div>
        <div className="p-5">
          {statusData.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="var(--card)"
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:flex-col sm:space-y-2 sm:gap-0">
                {statusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span>{item.name}</span>
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No tasks yet.</p>
          )}
        </div>
      </div>

      {/* Topic Accuracy Radar */}
      <div className="glass-card overflow-hidden rounded-2xl animate-in-up stagger-3">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Topic Accuracy Radar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Performance across your weakest topics.</p>
        </div>
        <div className="p-5">
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-border/50" />
                <PolarAngleAxis dataKey="subject" className="text-xs" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                <Radar
                  name="Accuracy"
                  dataKey="accuracy"
                  stroke="oklch(0.65 0.20 300)"
                  fill="oklch(0.65 0.20 300)"
                  fillOpacity={0.2}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Complete quizzes to see your topic accuracy radar.
            </p>
          )}
        </div>
      </div>

      {/* Task Types */}
      <div className="glass-card overflow-hidden rounded-2xl animate-in-up stagger-4">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Task Types</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Distribution of task types in your plan.</p>
        </div>
        <div className="p-5">
          {taskBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={taskBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" className="text-xs" width={70} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar dataKey="value" fill="oklch(0.70 0.18 155)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">No tasks yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
