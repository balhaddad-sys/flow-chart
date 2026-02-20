"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeakTopic } from "@/lib/types/stats";

interface WeakTopicsBannerProps {
  topics: WeakTopic[];
}

function getSeverity(accuracy: number) {
  if (accuracy < 0.4) return {
    color:    "text-red-600 dark:text-red-400",
    barColor: "bg-red-500",
    label:    "Critical",
  };
  if (accuracy < 0.6) return {
    color:    "text-orange-600 dark:text-orange-400",
    barColor: "bg-orange-500",
    label:    "Needs Work",
  };
  return {
    color:    "text-amber-600 dark:text-amber-400",
    barColor: "bg-amber-500",
    label:    "Review",
  };
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Areas to Improve</h3>
        </div>
        <Link
          href="/today/analytics"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Topics */}
      <div className="divide-y divide-border">
        {top3.map((topic) => {
          const severity    = getSeverity(topic.accuracy);
          const accuracyPct = Math.round(topic.accuracy * 100);

          return (
            <div key={topic.tag} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{topic.tag}</p>
                    <span className={cn("text-xs font-medium", severity.color)}>
                      {severity.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", severity.barColor)}
                        style={{ width: `${accuracyPct}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-medium tabular-nums", severity.color)}>
                      {accuracyPct}%
                    </span>
                  </div>
                </div>

                <Link
                  href={`/practice/quiz?mode=topic&topic=${encodeURIComponent(topic.tag)}`}
                  className="shrink-0"
                >
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                    <Play className="h-3 w-3" />
                    Practice
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
