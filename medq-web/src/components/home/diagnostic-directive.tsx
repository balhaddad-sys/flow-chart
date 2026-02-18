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
    <div
      className={cn(
        "glass-card overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            isStrong ? "bg-green-500/12" : "bg-primary/12"
          )}
        >
          <Brain
            className={cn(
              "h-3.5 w-3.5",
              isStrong ? "text-green-500" : "text-primary"
            )}
          />
        </div>
        <div>
          <h3 className="text-[0.8125rem] font-semibold tracking-tight">
            Today&rsquo;s Directive
          </h3>
          {accuracyPct != null && (
            <p className="text-[0.6875rem] text-muted-foreground">
              Overall accuracy: {accuracyPct}%
            </p>
          )}
        </div>
      </div>

      {/* Directives */}
      <div className="divide-y divide-border/40 px-5">
        {directives.map((directive, i) => (
          <div key={i} className="flex items-start gap-3 py-3.5">
            <CheckCircle2
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                i === 0
                  ? isStrong
                    ? "text-green-500"
                    : "text-primary"
                  : "text-muted-foreground/50"
              )}
            />
            <p className="text-sm leading-relaxed text-foreground/90">{directive}</p>
          </div>
        ))}
      </div>

      {/* Action link */}
      {!isStrong && (
        <div className="border-t border-border/50 px-5 py-3">
          <Link
            href="/practice"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Start targeted practice
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
