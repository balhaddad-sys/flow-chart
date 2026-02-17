"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListLoadingState } from "@/components/ui/loading-state";
import { BookOpen, Loader2, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import type { SectionModel } from "@/lib/types/section";

interface SectionListProps {
  sections: SectionModel[];
  loading: boolean;
}

const aiStatusConfig: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  PENDING: { icon: Loader2, color: "text-muted-foreground", label: "Pending" },
  PROCESSING: { icon: Loader2, color: "text-orange-500", label: "Analyzing" },
  ANALYZED: { icon: CheckCircle2, color: "text-green-500", label: "Ready" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

export function SectionList({ sections, loading }: SectionListProps) {
  if (loading) {
    return <ListLoadingState rows={4} />;
  }

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sections found. This file may still be processing.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const config = aiStatusConfig[section.aiStatus] ?? aiStatusConfig.PENDING;
        const StatusIcon = config.icon;
        const isAnimated = section.aiStatus === "PENDING" || section.aiStatus === "PROCESSING";

        return (
          <Card key={section.id} className="transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{section.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{section.estMinutes}m</span>
                  <span>&middot;</span>
                  <span>Difficulty {section.difficulty}/5</span>
                  {section.questionsCount > 0 && (
                    <>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5">
                        <HelpCircle className="h-3 w-3" />
                        {section.questionsCount} Qs
                      </span>
                    </>
                  )}
                </div>
                {section.topicTags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {section.topicTags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`gap-1 ${config.color}`}>
                  <StatusIcon className={`h-3 w-3 ${isAnimated ? "animate-spin" : ""}`} />
                  {config.label}
                </Badge>
                {section.aiStatus === "ANALYZED" && section.questionsCount > 0 && (
                  <Link
                    href={`/quiz?section=${section.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Quiz
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
