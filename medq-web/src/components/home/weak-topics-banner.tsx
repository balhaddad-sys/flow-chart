"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Play, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeakTopic } from "@/lib/types/stats";

interface WeakTopicsBannerProps {
  topics: WeakTopic[];
}

function getSeverity(accuracy: number): { color: string; border: string; bg: string } {
  if (accuracy < 0.4) return { color: "text-red-500", border: "border-red-500/30", bg: "bg-red-500/8" };
  if (accuracy < 0.6) return { color: "text-orange-500", border: "border-orange-500/30", bg: "bg-orange-500/8" };
  return { color: "text-amber-500", border: "border-amber-500/30", bg: "bg-amber-500/8" };
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <div className="glass-card space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Areas to improve
          </h3>
        </div>
        <Link href="/today/analytics" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {top3.map((topic) => {
          const severity = getSeverity(topic.accuracy);
          return (
            <div
              key={topic.tag}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all",
                severity.border,
                severity.bg
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{topic.tag}</p>
                <p className={cn("text-xs font-semibold tabular-nums", severity.color)}>
                  {Math.round(topic.accuracy * 100)}% accuracy
                </p>
              </div>
              <Link href={`/practice/quiz?mode=topic&topic=${encodeURIComponent(topic.tag)}`}>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2.5 text-xs shrink-0">
                  <Play className="h-3 w-3" />
                  Quiz
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
