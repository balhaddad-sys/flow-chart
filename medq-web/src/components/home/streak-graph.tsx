"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (count === 0) return "bg-muted";
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
      } catch (err) {
        console.warn("[StreakGraph] Failed to fetch activity:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [uid]);

  const { days, weeks } = useMemo(() => {
    const today = new Date();
    const activityMap = new Map(activity.map((a) => [a.date, a.completedCount]));
    const d: { date: string; count: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - i);
      const dateStr = dt.toISOString().slice(0, 10);
      d.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0 });
    }
    const w: { date: string; count: number }[][] = [];
    for (let i = 0; i < d.length; i += 7) {
      w.push(d.slice(i, i + 7));
    }
    return { days: d, weeks: w };
  }, [activity]);

  const streak = useMemo(() => computeStreak(activity), [activity]);
  const totalQuestions = useMemo(() => activity.reduce((sum, d) => sum + d.completedCount, 0), [activity]);

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse", className)}>
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-20 w-full rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame className={cn("h-4 w-4", streak > 0 ? "text-orange-500 animate-streak-glow" : "text-muted-foreground")} />
          <div>
            <h3 className="text-[13px] font-bold tracking-tight">Activity</h3>
            <p className="text-[11px] text-muted-foreground">Last 12 weeks</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-base font-bold tabular-nums leading-none">{streak}</p>
            <p className="text-[10px] text-muted-foreground">streak</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums leading-none">{totalQuestions}</p>
            <p className="text-[10px] text-muted-foreground">total Qs</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4">
        <div className="mb-1.5 flex gap-1">
          {weeks.map((week, wi) => {
            const firstDay = new Date(week[0].date);
            const showLabel = firstDay.getDate() <= 7;
            return (
              <div key={wi} className="w-3 text-[9px] text-muted-foreground text-center">
                {showLabel
                  ? firstDay.toLocaleDateString("en-US", { month: "short" })
                  : ""}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map(({ date, count }) => (
                <div
                  key={date}
                  title={`${date}: ${count} question${count !== 1 ? "s" : ""}`}
                  className={cn(
                    "h-3 w-3 rounded-sm transition-colors",
                    getIntensityClass(count)
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-1 justify-end">
          <span className="text-[9px] text-muted-foreground">Less</span>
          {[0, 1, 5, 10, 15].map((n) => (
            <div
              key={n}
              className={cn("h-2.5 w-2.5 rounded-sm", getIntensityClass(n))}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">More</span>
        </div>

        {streak >= 7 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 px-3 py-2">
            <Trophy className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
              {streak >= 30
                ? `${streak}-day streak — unstoppable!`
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
