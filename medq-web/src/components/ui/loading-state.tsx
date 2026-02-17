import type { ComponentType } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type IconComponent = ComponentType<{ className?: string }>;

interface PageLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  minHeightClassName?: string;
  icon?: IconComponent;
}

export function PageLoadingState({
  title = "Loading",
  description = "Please wait while we prepare your content.",
  className,
  minHeightClassName = "min-h-[55dvh]",
  icon: Icon = Sparkles,
}: PageLoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center", minHeightClassName, className)}>
      <div className="glass-card w-full max-w-lg p-6 sm:p-7">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 animate-glow-pulse">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <p className="text-center text-base font-semibold">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-center text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Working...
        </div>
        <div className="mt-5 space-y-2">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-[88%] rounded-full" />
          <Skeleton className="h-3.5 w-[75%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

interface SectionLoadingStateProps {
  title?: string;
  description?: string;
  rows?: number;
  className?: string;
}

export function SectionLoadingState({
  title = "Loading",
  description = "Fetching the latest data.",
  rows = 3,
  className,
}: SectionLoadingStateProps) {
  return (
    <div className={cn("glass-card space-y-4 p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-background/70 p-3">
            <Skeleton className="h-4 w-2/5 rounded-full" />
            <Skeleton className="mt-2 h-3 w-full rounded-full" />
            <Skeleton className="mt-2 h-3 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ListLoadingStateProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
}

export function ListLoadingState({
  rows = 4,
  className,
  itemClassName,
}: ListLoadingStateProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border/60 bg-card/75 p-4",
            itemClassName
          )}
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-2/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface InlineLoadingStateProps {
  label?: string;
  className?: string;
}

export function InlineLoadingState({
  label = "Loading...",
  className,
}: InlineLoadingStateProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

interface LoadingButtonLabelProps {
  label: string;
}

export function LoadingButtonLabel({ label }: LoadingButtonLabelProps) {
  return (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </>
  );
}
