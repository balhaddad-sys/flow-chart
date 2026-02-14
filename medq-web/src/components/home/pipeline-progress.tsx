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
  { label: "Plan", icon: Calendar, href: "/planner" },
  { label: "Study", icon: BookOpen, href: "/planner" },
  { label: "Quiz", icon: CircleHelp, href: "/questions" },
];

function getActiveStep(props: PipelineProgressProps): number {
  if (!props.hasFiles) return 0;
  if (!props.hasSections) return 1;
  if (!props.hasPlan) return 2;
  if (!props.hasQuizAttempts) return 3;
  return 5; // all done
}

export function PipelineProgress(props: PipelineProgressProps) {
  const activeStep = getActiveStep(props);

  // Hide when all steps complete
  if (activeStep >= steps.length) return null;

  const progressPercent = (activeStep / steps.length) * 100;

  return (
    <div className="space-y-3">
      {/* Mobile: compact single-line */}
      <div className="flex items-center gap-3 sm:hidden">
        <Progress value={progressPercent} className="h-2 flex-1" />
        <span className="shrink-0 text-xs text-muted-foreground">
          Step {activeStep + 1} of {steps.length}: {steps[activeStep].label}
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
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  isComplete && "text-foreground",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isComplete && !isCurrent && "text-muted-foreground"
                )}
              >
                <StepIcon className="h-3.5 w-3.5" />
                {step.label}
              </Link>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 min-w-4",
                    i < activeStep ? "bg-foreground/20" : "bg-border"
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
