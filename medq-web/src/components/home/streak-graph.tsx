"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayActivity {
  date: string;
  completedCount: number;
  minutesStudied: number;
}

interface StreakGraphProps {
  className?: string;
}

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-muted/40";
  if (count < 3)  return "bg-primary/25";
  if (count < 8)  return "bg-primary/50";
  if (count < 15) return "bg-primary/75";
  return "bg-primary";
}

function computeStreak(activity: DayActivity[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const activitySet = new Set(
    activity.filter((d) => d.completedCount > 0).map((d) => d.date)
  );

  let streak = 0;
  const cur = new Date();

  // Allow today to count even if not yet completed (grace)
  for (let i = 0; i <= 365; i++) {
    const dateStr = cur.toISOString().slice(0, 10);
    if (activitySet.has(dateStr)) {
      streak++;
    } else if (dateStr === today) {
      // today hasn't been counted yet — don't break the streak
    } else {
      break;
    }
    cur.setDate(cur.getDate() - 1);
  }

  return streak;
}

export function StreakGraph({ className }: StreakGraphProps) {
  const { uid } = useAuth();
  const [activity, setActivity] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    async function fetchActivity() {
      try {
        const ref = collection(db, `users/${uid}/activity`);
        const q = query(ref, orderBy("date", "desc"), limit(84));
        const snap = await getDocs(q);
        setActivity(snap.docs.map((d) => d.data() as DayActivity));
      } catch {
        // Non-critical; show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [uid]);

  // Build 12-week grid (84 days), starting from today
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = activity.find((a) => a.date === dateStr);
    days.push({ date: dateStr, count: found?.completedCount ?? 0 });
  }

  // Group into weeks (columns)
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const streak = computeStreak(activity);
  const totalQuestions = activity.reduce((sum, d) => sum + d.completedCount, 0);

  if (loading) {
    return (
      <div className={cn("glass-card p-5 space-y-3 animate-pulse", className)}>
        <div className="h-4 w-32 rounded bg-muted/60" />
        <div className="h-20 w-full rounded bg-muted/40" />
      </div>
    );
  }

  return (
    <div className={cn("glass-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/12">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-tight">Study Streak</h3>
            <p className="text-[0.6875rem] text-muted-foreground">Last 12 weeks</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-lg font-bold tabular-nums leading-none">{streak}</p>
            <p className="text-[0.65rem] text-muted-foreground">day streak</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums leading-none">{totalQuestions}</p>
            <p className="text-[0.65rem] text-muted-foreground">Qs answered</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-5">
        {/* Month labels */}
        <div className="mb-1.5 flex gap-1">
          {weeks.map((week, wi) => {
            const firstDay = new Date(week[0].date);
            const showLabel = firstDay.getDate() <= 7;
            return (
              <div key={wi} className="w-3 text-[0.55rem] text-muted-foreground/60 text-center">
                {showLabel
                  ? firstDay.toLocaleDateString("en-US", { month: "short" })
                  : ""}
              </div>
            );
          })}
        </div>

        {/* Cell grid */}
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map(({ date, count }) => (
                <div
                  key={date}
                  title={`${date}: ${count} question${count !== 1 ? "s" : ""}`}
                  className={cn(
                    "h-3 w-3 rounded-[2px] transition-colors",
                    getIntensityClass(count)
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-1 justify-end">
          <span className="text-[0.6rem] text-muted-foreground">Less</span>
          {[0, 1, 5, 10, 15].map((n) => (
            <div
              key={n}
              className={cn("h-2.5 w-2.5 rounded-[2px]", getIntensityClass(n))}
            />
          ))}
          <span className="text-[0.6rem] text-muted-foreground">More</span>
        </div>

        {/* Streak milestone */}
        {streak >= 7 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-500/8 border border-orange-500/20 px-3 py-2">
            <Trophy className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
              {streak >= 30
                ? `${streak}-day streak — you're unstoppable!`
                : streak >= 14
                ? `${streak}-day streak — incredible consistency!`
                : `${streak}-day streak — keep it up!`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
