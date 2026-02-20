"use client";

import { cn } from "@/lib/utils";
import { NumberTicker } from "@/components/ui/animate-in";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accentColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  icon,
  trend,
  trendLabel,
  className,
}: StatCardProps) {
  return (
    <div className={cn("metric-card", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="text-muted-foreground/50">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-0.5">
        <NumberTicker
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          className="text-xl font-bold tracking-tight"
        />
      </div>

      {trend && trendLabel && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend === "up" && (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span
            className={cn(
              "text-[11px] font-medium",
              trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
            )}
          >
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}
