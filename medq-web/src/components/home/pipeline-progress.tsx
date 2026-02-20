"use client";

import Link from "next/link";
import { Check, Upload, Cpu, Calendar, BookOpen, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineProgressProps {
  hasFiles: boolean;
  hasSections: boolean;
  hasPlan: boolean;
  hasQuizAttempts: boolean;
}

const steps = [
  { label: "Upload", description: "Add study materials", icon: Upload, href: "/library" },
  { label: "Process", description: "AI analyses content", icon: Cpu, href: "/library" },
  { label: "Plan", description: "Generate your schedule", icon: Calendar, href: "/today/plan" },
  { label: "Study", description: "Work through sessions", icon: BookOpen, href: "/today/plan" },
  { label: "Quiz", description: "Test your knowledge", icon: CircleHelp, href: "/practice" },
];

function getActiveStep(props: PipelineProgressProps): number {
  if (!props.hasFiles) return 0;
  if (!props.hasSections) return 1;
  if (!props.hasPlan) return 2;
  if (!props.hasQuizAttempts) return 3;
  return 5;
}

export function PipelineProgress(props: PipelineProgressProps) {
  const activeStep = getActiveStep(props);

  if (activeStep >= steps.length) return null;

  const progressPercent = Math.round((activeStep / steps.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Progress bar */}
      <div className="h-0.5 w-full overflow-hidden rounded-t-xl bg-border">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-medium">Getting Started</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {steps[activeStep]?.description ?? "All steps complete"} — Step {activeStep + 1} of {steps.length}
            </p>
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {progressPercent}%
          </span>
        </div>

        {/* Desktop stepper */}
        <div className="hidden sm:flex items-center gap-1.5">
          {steps.map((step, i) => {
            const isComplete = i < activeStep;
            const isCurrent  = i === activeStep;
            const StepIcon   = isComplete ? Check : step.icon;

            return (
              <div key={step.label} className="flex items-center gap-1.5 flex-1 last:flex-none">
                <Link
                  href={step.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                    isComplete && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    isCurrent  && "bg-primary text-primary-foreground",
                    !isComplete && !isCurrent && "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <StepIcon className="h-3.5 w-3.5 shrink-0" />
                  {step.label}
                </Link>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1 min-w-3 rounded-full transition-colors",
                      i < activeStep ? "bg-emerald-300 dark:bg-emerald-500/40" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: current step */}
        <div className="sm:hidden">
          <Link
            href={steps[activeStep].href}
            className="flex items-center gap-3 rounded-lg bg-accent px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {(() => { const StepIcon = steps[activeStep].icon; return <StepIcon className="h-4 w-4 text-primary" />; })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{steps[activeStep].label}</p>
              <p className="text-xs text-muted-foreground">{steps[activeStep].description}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">Next &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
