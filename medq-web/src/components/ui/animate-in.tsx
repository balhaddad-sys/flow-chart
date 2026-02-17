"use client";

import { useEffect, useRef, useState, Children, isValidElement, useCallback } from "react";
import { cn } from "@/lib/utils";

/* ─── AnimateIn ─────────────────────────────────────────────── */
type Animation = "fade" | "slide-up" | "slide-down" | "slide-right" | "slide-left" | "scale" | "bounce";

const animationClass: Record<Animation, string> = {
  fade: "animate-in-fade",
  "slide-up": "animate-in-up",
  "slide-down": "animate-in-down",
  "slide-right": "animate-in-right",
  "slide-left": "animate-in-left",
  scale: "animate-in-scale",
  bounce: "animate-in-bounce",
};

interface AnimateInProps {
  children: React.ReactNode;
  animation?: Animation;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  as?: React.ElementType;
}

export function AnimateIn({
  children,
  animation = "slide-up",
  delay = 0,
  duration,
  className,
  once = true,
  as: Tag = "div",
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={cn(
        visible ? animationClass[animation] : "opacity-0",
        className
      )}
      style={{
        animationDelay: delay ? `${delay}ms` : undefined,
        animationDuration: duration ? `${duration}ms` : undefined,
      }}
    >
      {children}
    </Tag>
  );
}

/* ─── StaggerGroup ──────────────────────────────────────────── */
interface StaggerGroupProps {
  children: React.ReactNode;
  staggerMs?: number;
  animation?: Animation;
  className?: string;
  as?: React.ElementType;
}

export function StaggerGroup({
  children,
  staggerMs = 60,
  animation = "slide-up",
  className,
  as: Tag = "div",
}: StaggerGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            className={visible ? animationClass[animation] : "opacity-0"}
            style={{ animationDelay: `${i * staggerMs}ms` }}
          >
            {child}
          </div>
        );
      })}
    </Tag>
  );
}

/* ─── NumberTicker ──────────────────────────────────────────── */
interface NumberTickerProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function NumberTicker({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animate = useCallback(() => {
    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [value, duration]);

  useEffect(() => {
    if (started) animate();
  }, [started, animate]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
