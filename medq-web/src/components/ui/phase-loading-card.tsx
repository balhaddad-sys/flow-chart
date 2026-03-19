"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export interface Phase {
  key: string;
  label: string;
  description?: string;
}

export type PhaseStatus = "pending" | "active" | "done" | "failed";

interface PhaseLoadingCardProps {
  /** Ordered list of phases in this workflow */
  phases: Phase[];
  /** Key of the currently active phase */
  activePhase: string;
  /** Optional failure state — shows error styling on active phase */
  failed?: boolean;
  /** Optional failure message */
  failedMessage?: string;
  /** Elapsed seconds (shown when > 0) */
  elapsedSec?: number;
  /** Whether the entire workflow is complete */
  complete?: boolean;
  /** Optional completion message */
  completeMessage?: string;
  /** Called when user clicks retry (only shown on failure) */
  onRetry?: () => void;
  /** Optional className for outer container */
  className?: string;
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/**
 * PhaseLoadingCard — a reusable multi-phase progress indicator.
 *
 * Shows named workflow steps with clear active/done/pending/failed states.
 * Use for any operation that takes > 2 seconds and has identifiable stages.
 *
 * Usage:
 * ```tsx
 * <PhaseLoadingCard
 *   phases={[
 *     { key: "fetch", label: "Collecting sections" },
 *     { key: "calc", label: "Calculating workload" },
 *     { key: "place", label: "Placing tasks" },
 *     { key: "save", label: "Saving plan" },
 *   ]}
 *   activePhase="calc"
 * />
 * ```
 */
export function PhaseLoadingCard({
  phases,
  activePhase,
  failed = false,
  failedMessage,
  elapsedSec = 0,
  complete = false,
  completeMessage,
  onRetry,
  className,
}: PhaseLoadingCardProps) {
  const activeIndex = phases.findIndex((p) => p.key === activePhase);
  const progress = complete
    ? 100
    : phases.length > 0
    ? Math.round(((activeIndex + 0.5) / phases.length) * 100)
    : 0;

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden animate-in-up", className)}>
      {/* Progress bar */}
      <div className="h-1 w-full bg-muted/40">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            failed ? "bg-destructive" : complete ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Phase steps */}
        <div className="space-y-1.5">
          {phases.map((phase, i) => {
            let status: PhaseStatus = "pending";
            if (complete || i < activeIndex) status = "done";
            else if (i === activeIndex) status = failed ? "failed" : "active";

            return (
              <div
                key={phase.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-all",
                  status === "active" && "bg-primary/8 text-foreground",
                  status === "done" && "text-muted-foreground",
                  status === "pending" && "text-muted-foreground/50",
                  status === "failed" && "bg-destructive/8 text-destructive"
                )}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : status === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span className={cn("flex-1", status === "active" && "font-medium")}>
                  {phase.label}
                </span>
                {status === "active" && elapsedSec > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatElapsed(elapsedSec)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Failure message + retry */}
        {failed && (
          <div className="rounded-lg bg-destructive/8 px-3 py-2.5 text-sm">
            <p className="text-destructive font-medium">
              {failedMessage || "Something went wrong. Please try again."}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Complete message */}
        {complete && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-sm">
            <p className="text-emerald-700 dark:text-emerald-300 font-medium">
              {completeMessage || "Done!"}
            </p>
          </div>
        )}

        {/* Stale hint */}
        {!failed && !complete && elapsedSec > 30 && (
          <p className="text-xs text-muted-foreground">
            Still working — this is taking a bit longer than usual but is running normally.
          </p>
        )}
      </div>
    </div>
  );
}
