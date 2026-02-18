"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, AlertCircle, Zap } from "lucide-react";

interface IngestionStepperProps {
  status: string;
  progress: number;
  stepLabel: string;
  readyQuestionCount?: number;
  totalQuestionTarget?: number;
  className?: string;
  onQuickReview?: () => void;
}

const LIFECYCLE_ORDER = [
  "queued",
  "parsing",
  "chunking",
  "indexing",
  "generating_questions",
  "ready_partial",
  "ready_full",
];

const STEP_LABELS: Record<string, string> = {
  queued:               "Queued",
  parsing:              "Reading",
  chunking:             "Structuring",
  indexing:             "Indexing",
  generating_questions: "Generating Questions",
  ready_partial:        "Partially Ready",
  ready_full:           "Complete",
};

const QUICK_REVIEW_THRESHOLD = 5;

export function IngestionStepper({
  status,
  progress,
  stepLabel,
  readyQuestionCount = 0,
  totalQuestionTarget = 0,
  className,
  onQuickReview,
}: IngestionStepperProps) {
  const isFailed = status === "failed";
  const isComplete = status === "ready_full";
  const currentIndex = LIFECYCLE_ORDER.indexOf(status);
  const canQuickReview = readyQuestionCount >= QUICK_REVIEW_THRESHOLD && !isComplete;

  if (isComplete) return null;

  return (
    <div className={cn("glass-card overflow-hidden", className)}>
      {/* Progress bar */}
      <div className="h-1 w-full bg-muted/40">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            isFailed ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isFailed
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            )}
          >
            {isFailed ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {isFailed ? "Processing failed" : stepLabel}
            </p>
            {!isFailed && totalQuestionTarget > 0 && readyQuestionCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {readyQuestionCount} of {totalQuestionTarget} questions ready
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {isFailed ? "" : `${Math.round(progress)}%`}
          </span>
        </div>

        {/* Step pills */}
        {!isFailed && (
          <div className="flex flex-wrap gap-1.5">
            {LIFECYCLE_ORDER.map((step, i) => {
              const isDone = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <span
                  key={step}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.65rem] font-medium transition-all",
                    isDone
                      ? "bg-primary/15 text-primary"
                      : isCurrent
                      ? "bg-primary/25 text-primary ring-1 ring-primary/40"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isDone && (
                    <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />
                  )}
                  {STEP_LABELS[step]}
                </span>
              );
            })}
          </div>
        )}

        {/* Quick Review CTA */}
        {canQuickReview && onQuickReview && (
          <button
            onClick={onQuickReview}
            className="flex w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/15 active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              Quick Review — {readyQuestionCount} questions ready now
            </span>
            <span className="text-xs opacity-70">More loading…</span>
          </button>
        )}

        {/* Tooltip / explanation */}
        {!isFailed && !canQuickReview && (
          <p className="text-[0.7rem] text-muted-foreground">
            {status === "generating_questions"
              ? "AI is reading your material and crafting high-yield exam questions. This usually takes 1–2 minutes."
              : "Processing your document — this is a one-time step and runs in the background."}
          </p>
        )}
      </div>
    </div>
  );
}
