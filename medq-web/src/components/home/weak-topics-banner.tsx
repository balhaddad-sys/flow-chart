"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { WeakTopic } from "@/lib/types/stats";

interface WeakTopicsBannerProps {
  topics: WeakTopic[];
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <div className="glass-card space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Areas to improve
        </h3>
        <Link href="/today/analytics" className="text-xs text-muted-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {top3.map((topic) => (
          <div key={topic.tag} className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="rounded-full border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
              {topic.tag} — {Math.round(topic.accuracy * 100)}%
            </Badge>
            <Link href={`/practice/quiz?mode=topic&topic=${encodeURIComponent(topic.tag)}`}>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2.5 text-xs">
                <Play className="h-3 w-3" />
                Quiz
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
