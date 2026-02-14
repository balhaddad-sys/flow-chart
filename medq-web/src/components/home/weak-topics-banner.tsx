"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { WeakTopic } from "@/lib/types/stats";

interface WeakTopicsBannerProps {
  topics: WeakTopic[];
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <div className="glass-card space-y-3 p-4 sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Areas to improve
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {top3.map((topic) => (
          <Link href="/dashboard" key={topic.tag}>
            <Badge variant="outline" className="rounded-full border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
              {topic.tag} - {Math.round(topic.accuracy * 100)}%
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
