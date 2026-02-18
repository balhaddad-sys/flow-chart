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
    color:      "text-red-600 dark:text-red-400",
    barColor:   "bg-red-500",
    border:     "border-red-500/25",
    bg:         "bg-red-500/6",
    label:      "Critical",
    labelColor: "text-red-600 dark:text-red-400",
  };
  if (accuracy < 0.6) return {
    color:      "text-orange-600 dark:text-orange-400",
    barColor:   "bg-orange-500",
    border:     "border-orange-500/25",
    bg:         "bg-orange-500/6",
    label:      "Needs Work",
    labelColor: "text-orange-600 dark:text-orange-400",
  };
  return {
    color:      "text-amber-600 dark:text-amber-400",
    barColor:   "bg-amber-500",
    border:     "border-amber-500/25",
    bg:         "bg-amber-500/6",
    label:      "Review",
    labelColor: "text-amber-600 dark:text-amber-400",
  };
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/12">
            <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-tight">Areas to Improve</h3>
            <p className="text-[0.6875rem] text-muted-foreground">
              {topics.length} topic{topics.length !== 1 ? "s" : ""} need attention
            </p>
          </div>
        </div>
        <Link
          href="/today/analytics"
          className="text-[0.75rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Topics */}
      <div className="divide-y divide-border/40">
        {top3.map((topic) => {
          const severity    = getSeverity(topic.accuracy);
          const accuracyPct = Math.round(topic.accuracy * 100);

          return (
            <div key={topic.tag} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[0.8125rem] font-medium">{topic.tag}</p>
                    <span className={cn(
                      "shrink-0 rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide",
                      severity.bg,
                      severity.border,
                      severity.labelColor
                    )}>
                      {severity.label}
                    </span>
                  </div>

                  {/* Accuracy bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.6875rem] text-muted-foreground">Accuracy</span>
                      <span className={cn("text-[0.6875rem] font-bold tabular-nums", severity.color)}>
                        {accuracyPct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", severity.barColor)}
                        style={{ width: `${accuracyPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Link
                  href={`/practice/quiz?mode=topic&topic=${encodeURIComponent(topic.tag)}`}
                  className="shrink-0"
                >
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl px-2.5 text-xs">
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
