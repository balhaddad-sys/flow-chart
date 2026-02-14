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
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Areas to improve
      </h3>
      <div className="flex flex-wrap gap-2">
        {top3.map((topic) => (
          <Link href="/dashboard" key={topic.tag}>
            <Badge variant="outline" className="text-xs hover:bg-accent">
              {topic.tag} — {Math.round(topic.accuracy * 100)}%
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
