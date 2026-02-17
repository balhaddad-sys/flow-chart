"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface XpBadgeProps {
  xp: number;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function XpBadge({ xp, animate = true, size = "md", className }: XpBadgeProps) {
  const sizes = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const iconSizes = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-4 w-4" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-600 dark:text-amber-400",
        "border border-amber-400/30",
        animate && "animate-in-bounce",
        sizes[size],
        className
      )}
    >
      <Sparkles className={iconSizes[size]} />
      +{xp} XP
    </span>
  );
}

/**
 * Calculate client-side XP from stats.
 * correctAnswers * 10 + completedTasks * 25
 */
export function calculateXp(correctAnswers: number, completedTasks: number): number {
  return correctAnswers * 10 + completedTasks * 25;
}
