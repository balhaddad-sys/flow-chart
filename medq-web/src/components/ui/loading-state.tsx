import type { ComponentType } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type IconComponent = ComponentType<{ className?: string }>;

interface PageLoadingStateProps {
  title?: string;
  description?: string;
  expectation?: string;
  className?: string;
  minHeightClassName?: string;
  icon?: IconComponent;
}

export function PageLoadingState({
  title = "Loading",
  description = "Please wait while we prepare your content.",
  expectation = "This is running normally. Larger tasks can take up to a couple of minutes.",
  className,
  minHeightClassName = "min-h-[55dvh]",
  icon: Icon = Sparkles,
}: PageLoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center", minHeightClassName, className)}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="text-[14px] font-bold tracking-tight">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Working in the background
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/85">{expectation}</p>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-2.5 w-[88%] rounded-full" />
          <Skeleton className="h-2.5 w-[72%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

interface SectionLoadingStateProps {
  title?: string;
  description?: string;
  expectation?: string;
  rows?: number;
  className?: string;
}

export function SectionLoadingState({
  title = "Loading",
  description = "Fetching the latest data.",
  expectation = "Still working normally. You can keep using the app while this completes.",
  rows = 3,
  className,
}: SectionLoadingStateProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card space-y-4 p-5", className)}>
      <div className="flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/85">{expectation}</p>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border p-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ListLoadingStateProps {
  rows?: number;
  label?: string;
  className?: string;
  itemClassName?: string;
}

export function ListLoadingState({
  rows = 4,
  label = "Loading content...",
  className,
  itemClassName,
}: ListLoadingStateProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        {label}
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border bg-card p-3.5",
            itemClassName
          )}
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface InlineLoadingStateProps {
  label?: string;
  hint?: string;
  className?: string;
}

export function InlineLoadingState({
  label = "Working in the background...",
  hint,
  className,
}: InlineLoadingStateProps) {
  return (
    <div className={cn("inline-flex flex-col gap-0.5 text-sm text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>{label}</span>
      </span>
      {hint && <span className="text-[11px] text-muted-foreground/80">{hint}</span>}
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
