"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStats } from "@/lib/hooks/useStats";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AnalyticsPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { stats, loading: statsLoading } = useStats(courseId);
  const { tasks, loading: tasksLoading } = useTasks(courseId);

  const loading = statsLoading || tasksLoading;

  // Task breakdown by type
  const taskBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.type] = (counts[t.type] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  // Task completion by status
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

  // Study minutes by day of week
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

  // Topic radar from weak topics
  const radarData = useMemo(() => {
    if (!stats?.weakestTopics) return [];
    return stats.weakestTopics.slice(0, 6).map((topic) => ({
      subject: topic.tag.length > 12 ? topic.tag.slice(0, 12) + "..." : topic.tag,
      accuracy: Math.round(topic.accuracy * 100),
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Progress
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Detailed Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Visual breakdown of your study patterns and performance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Study minutes by day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Study Time by Day</CardTitle>
            <p className="text-xs text-muted-foreground">Minutes spent studying each day of the week.</p>
          </CardHeader>
          <CardContent>
            {weeklyMinutes.some((d) => d.minutes > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyMinutes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ fontSize: "12px" }}
                    formatter={(value) => [`${value}m`, "Minutes"]}
                  />
                  <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Complete some tasks to see your study time breakdown.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Task completion breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Status</CardTitle>
            <p className="text-xs text-muted-foreground">Breakdown of your task completion status.</p>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span>{item.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No tasks yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Topic radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic Accuracy Radar</CardTitle>
            <p className="text-xs text-muted-foreground">Performance across your weakest topics.</p>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="subject" className="text-xs" />
                  <PolarRadiusAxis domain={[0, 100]} className="text-xs" />
                  <Radar
                    name="Accuracy"
                    dataKey="accuracy"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Complete quizzes to see your topic accuracy radar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Task type breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Types</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution of task types in your plan.</p>
          </CardHeader>
          <CardContent>
            {taskBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={taskBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No tasks yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
