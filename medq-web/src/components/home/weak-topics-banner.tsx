"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { WeakTopic } from "@/lib/types/stats";

interface WeakTopicsBannerProps {
  topics: WeakTopic[];
}

export function WeakTopicsBanner({ topics }: WeakTopicsBannerProps) {
  if (topics.length === 0) return null;

  const top3 = topics.slice(0, 3);

  return (
    <Link href="/dashboard">
      <Card className="border-orange-200 bg-orange-50/50 transition-colors hover:bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20 dark:hover:bg-orange-950/30">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-medium">Weak topics need attention</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {top3.map((topic) => (
                <Badge key={topic.tag} variant="outline" className="text-xs">
                  {topic.tag} ({Math.round(topic.accuracy * 100)}%)
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
