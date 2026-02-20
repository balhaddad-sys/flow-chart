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
    <div className={cn("rounded-xl border border-border bg-card shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-3",
        isStrong ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-primary/5"
      )}>
        <Brain className={cn("h-4 w-4", isStrong ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} />
        <div>
          <h3 className="text-[13px] font-bold tracking-tight">AI Recommendations</h3>
          {accuracyPct != null && (
            <p className="text-[11px] text-muted-foreground">
              Overall accuracy: <span className={cn("font-semibold", isStrong ? "text-emerald-600 dark:text-emerald-400" : "text-primary")}>{accuracyPct}%</span>
            </p>
          )}
        </div>
      </div>

      {/* Directives */}
      <div className="divide-y divide-border/50 px-4">
        {directives.map((directive, i) => (
          <div key={i} className="flex items-start gap-2.5 py-3">
            <CheckCircle2
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                i === 0
                  ? isStrong ? "text-emerald-500" : "text-primary"
                  : "text-muted-foreground/30"
              )}
            />
            <p className="text-[13px] leading-relaxed">{directive}</p>
          </div>
        ))}
      </div>

      {/* Action */}
      {!isStrong && (
        <div className="border-t border-border/50 px-4 py-2.5">
          <Link
            href="/practice"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Start targeted practice
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
