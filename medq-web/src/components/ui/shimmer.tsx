import { cn } from "@/lib/utils";

/* ─── Base Shimmer Bar ──────────────────────────────────────── */
function ShimmerBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/70 animate-shimmer",
        className
      )}
      style={style}
    />
  );
}

/* ─── ShimmerCard ───────────────────────────────────────────── */
export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card p-5 space-y-4", className)}>
      <ShimmerBar className="h-5 w-2/5" />
      <ShimmerBar className="h-4 w-full" />
      <ShimmerBar className="h-4 w-4/5" />
      <ShimmerBar className="h-4 w-3/5" />
    </div>
  );
}

/* ─── ShimmerList ───────────────────────────────────────────── */
export function ShimmerList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-4">
          <ShimmerBar className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <ShimmerBar className="h-4 w-3/5" />
            <ShimmerBar className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ShimmerStats ──────────────────────────────────────────── */
export function ShimmerStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="metric-card space-y-3">
          <ShimmerBar className="h-3 w-1/2" />
          <ShimmerBar className="h-7 w-3/5" />
          <ShimmerBar className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/* ─── ShimmerChart ──────────────────────────────────────────── */
export function ShimmerChart({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card p-5 space-y-4", className)}>
      <ShimmerBar className="h-5 w-1/3" />
      <div className="flex items-end gap-2 h-32">
        {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
          <ShimmerBar key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
