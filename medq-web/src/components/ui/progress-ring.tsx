"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: React.ReactNode;
  animate?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  color = "var(--color-primary)",
  trackColor = "var(--color-border)",
  label,
  animate = true,
  className,
}: ProgressRingProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(!animate);
  const clamped = Math.min(100, Math.max(0, value));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={visible ? offset : circumference}
          style={{
            transition: animate ? "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
          }}
        />
      </svg>
      {label !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">
          {label}
        </div>
      )}
    </div>
  );
}
