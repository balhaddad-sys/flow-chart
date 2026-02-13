"use client";

import { useState } from "react";
import { useStats } from "@/lib/hooks/useStats";
import { useCourseStore } from "@/lib/stores/course-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, Wrench, Loader2 } from "lucide-react";
import * as fn from "@/lib/firebase/functions";

export default function DashboardPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { stats, loading } = useStats(courseId);
  const [fixPlanLoading, setFixPlanLoading] = useState(false);
  const [fixPlanResult, setFixPlanResult] = useState<string | null>(null);

  async function handleFixPlan() {
    if (!courseId) return;
    setFixPlanLoading(true);
    setFixPlanResult(null);
    try {
      await fn.runFixPlan({ courseId });
      setFixPlanResult("Fix plan generated! Check your planner for new tasks.");
    } catch (err) {
      setFixPlanResult(err instanceof Error ? err.message : "Failed to generate fix plan");
    } finally {
      setFixPlanLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const weakTopics = stats?.weakestTopics ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="mt-1 text-muted-foreground">
            Identify and address your weak areas.
          </p>
        </div>
        <Button onClick={handleFixPlan} disabled={fixPlanLoading || !courseId || weakTopics.length === 0}>
          {fixPlanLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wrench className="mr-2 h-4 w-4" />
          )}
          Generate Fix Plan
        </Button>
      </div>

      {fixPlanResult && (
        <div className="rounded-lg bg-muted p-3 text-sm">{fixPlanResult}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Overall Accuracy</p>
            <p className="text-3xl font-bold">
              {stats ? `${Math.round(stats.overallAccuracy * 100)}%` : "--"}
            </p>
            <Progress value={stats ? stats.overallAccuracy * 100 : 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Questions Answered</p>
            <p className="text-3xl font-bold">{stats?.totalQuestionsAnswered ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completion</p>
            <p className="text-3xl font-bold">
              {stats ? `${Math.round(stats.completionPercent)}%` : "0%"}
            </p>
            <Progress value={stats?.completionPercent ?? 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Weak Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weakTopics.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No weak topics identified yet. Complete more quizzes to see insights.
            </p>
          ) : (
            <div className="space-y-3">
              {weakTopics.map((topic) => (
                <div key={topic.tag} className="flex items-center gap-3">
                  <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{topic.tag}</span>
                      <Badge
                        variant={topic.accuracy < 0.5 ? "destructive" : "secondary"}
                        className="text-xs ml-2"
                      >
                        {Math.round(topic.accuracy * 100)}%
                      </Badge>
                    </div>
                    <Progress value={topic.accuracy * 100} className="mt-1 h-1.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
