"use client";

import Link from "next/link";
import { Brain, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosticDirectiveProps {
  directives?: string[];
  overallAccuracy?: number;
  className?: string;
}

export function DiagnosticDirective({
  directives,
  overallAccuracy,
  className,
}: DiagnosticDirectiveProps) {
  if (!directives || directives.length === 0) return null;

  const accuracyPct = overallAccuracy != null ? Math.round(overallAccuracy * 100) : null;
  const isStrong = accuracyPct != null && accuracyPct >= 80;

  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Brain className={cn("h-4 w-4", isStrong ? "text-emerald-500" : "text-primary")} />
        <div>
          <h3 className="text-sm font-medium">Recommendations</h3>
          {accuracyPct != null && (
            <p className="text-xs text-muted-foreground">
              Overall accuracy: {accuracyPct}%
            </p>
          )}
        </div>
      </div>

      {/* Directives */}
      <div className="divide-y divide-border px-5">
        {directives.map((directive, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <CheckCircle2
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                i === 0
                  ? isStrong ? "text-emerald-500" : "text-primary"
                  : "text-muted-foreground/40"
              )}
            />
            <p className="text-sm leading-relaxed">{directive}</p>
          </div>
        ))}
      </div>

      {/* Action */}
      {!isStrong && (
        <div className="border-t border-border px-5 py-3">
          <Link
            href="/practice"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Start targeted practice
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
