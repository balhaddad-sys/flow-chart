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
  {
    label: "Upload",
    description: "Add study materials",
    icon: Upload,
    href: "/library",
  },
  {
    label: "Process",
    description: "AI analyses content",
    icon: Cpu,
    href: "/library",
  },
  {
    label: "Plan",
    description: "Generate your schedule",
    icon: Calendar,
    href: "/today/plan",
  },
  {
    label: "Study",
    description: "Work through sessions",
    icon: BookOpen,
    href: "/today/plan",
  },
  {
    label: "Quiz",
    description: "Test your knowledge",
    icon: CircleHelp,
    href: "/practice",
  },
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
    <div className="glass-card overflow-hidden animate-in-up">
      {/* Progress bar at top */}
      <div className="h-0.5 w-full bg-border/50">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-700"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[0.8125rem] font-semibold">Getting Started</p>
            <p className="text-[0.75rem] text-muted-foreground mt-0.5">
              {steps[activeStep]?.description ?? "All steps complete"} — Step {activeStep + 1} of {steps.length}
            </p>
          </div>
          <span className="text-[0.75rem] font-semibold tabular-nums text-muted-foreground">
            {progressPercent}%
          </span>
        </div>

        {/* Desktop: horizontal stepper */}
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
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 whitespace-nowrap",
                    isComplete && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/18",
                    isCurrent  && "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px] shadow-primary/60 animate-glow-pulse",
                    !isComplete && !isCurrent && "bg-muted/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <StepIcon className={cn("h-3.5 w-3.5 shrink-0", isComplete && "animate-in-scale")} />
                  {step.label}
                </Link>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1 min-w-3 rounded-full transition-colors duration-700",
                      i < activeStep ? "bg-emerald-500/50" : "bg-border/60"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: current step highlight */}
        <div className="sm:hidden">
          <Link
            href={steps[activeStep].href}
            className="flex items-center gap-3 rounded-xl bg-primary/8 border border-primary/20 px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
              {(() => { const StepIcon = steps[activeStep].icon; return <StepIcon className="h-4 w-4 text-primary" />; })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{steps[activeStep].label}</p>
              <p className="text-xs text-muted-foreground">{steps[activeStep].description}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-primary">Next &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
