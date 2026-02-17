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
  accentColor = "var(--color-primary)",
  className,
}: StatCardProps) {
  return (
    <div className={cn("metric-card relative overflow-hidden", className)}>
      {/* Accent line */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {icon && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 15%, transparent)` }}
            >
              {icon}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <NumberTicker
            value={value}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            className="text-2xl font-semibold tracking-tight"
          />
        </div>

        {trend && trendLabel && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" && (
              <TrendingUp className="h-3 w-3" style={{ color: "var(--success)" }} />
            )}
            {trend === "down" && (
              <TrendingDown className="h-3 w-3" style={{ color: "var(--destructive)" }} />
            )}
            <span
              className="text-[11px] font-medium"
              style={{
                color: trend === "up" ? "var(--success)" : trend === "down" ? "var(--destructive)" : "var(--muted-foreground)",
              }}
            >
              {trendLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
