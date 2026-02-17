"use client";

import Link from "next/link";
import { Check, Upload, Cpu, Calendar, BookOpen, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface PipelineProgressProps {
  hasFiles: boolean;
  hasSections: boolean;
  hasPlan: boolean;
  hasQuizAttempts: boolean;
}

const steps = [
  { label: "Upload", icon: Upload, href: "/library" },
  { label: "Process", icon: Cpu, href: "/library" },
  { label: "Plan", icon: Calendar, href: "/today/plan" },
  { label: "Study", icon: BookOpen, href: "/today/plan" },
  { label: "Quiz", icon: CircleHelp, href: "/practice" },
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

  const progressPercent = (activeStep / steps.length) * 100;

  return (
    <div className="glass-card space-y-4 p-4 sm:p-5 animate-in-up">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Learning Pipeline</p>
        <span className="text-xs text-muted-foreground">
          Step {activeStep + 1} of {steps.length}
        </span>
      </div>

      {/* Mobile: compact single-line */}
      <div className="flex items-center gap-3 sm:hidden">
        <Progress value={progressPercent} className="h-2 flex-1" />
        <span className="min-w-0 max-w-[42%] truncate text-right text-xs text-muted-foreground">
          {steps[activeStep].label}
        </span>
      </div>

      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-center gap-1">
        {steps.map((step, i) => {
          const isComplete = i < activeStep;
          const isCurrent = i === activeStep;
          const StepIcon = isComplete ? Check : step.icon;

          return (
            <div key={step.label} className="flex items-center gap-1 flex-1 last:flex-none">
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-300",
                  isComplete && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  isCurrent && "bg-primary text-primary-foreground shadow-[0_8px_18px_-12px] shadow-primary/50 animate-glow-pulse",
                  !isComplete && !isCurrent && "bg-muted/70 text-muted-foreground"
                )}
              >
                <StepIcon className={cn("h-3.5 w-3.5", isComplete && "animate-in-scale")} />
                {step.label}
              </Link>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 min-w-4 transition-colors duration-500",
                    i < activeStep ? "bg-emerald-500/40" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
