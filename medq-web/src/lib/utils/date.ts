import { Timestamp } from "firebase/firestore";

/**
 * Get the user's IANA timezone. Uses the browser API which returns the
 * system timezone (e.g. "Europe/London", "America/New_York").
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Get start-of-day and end-of-day boundaries in the user's local timezone.
 * All day-boundary logic flows through this single function.
 */
export function getTodayBounds(): { startOfDay: Date; endOfDay: Date } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

/**
 * Get a stable YYYY-MM-DD key for a date in the user's local timezone.
 */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isToday(ts: Timestamp): boolean {
  const date = ts.toDate();
  const { startOfDay, endOfDay } = getTodayBounds();
  return date >= startOfDay && date < endOfDay;
}

export function isSameDay(a: Timestamp, b: Timestamp): boolean {
  return toDayKey(a.toDate()) === toDayKey(b.toDate());
}

export function groupTasksByDay<T extends { dueDate: Timestamp }>(
  tasks: T[]
): { date: Timestamp; label: string; tasks: T[] }[] {
  const groups: Map<string, { date: Timestamp; tasks: T[] }> = new Map();

  for (const task of tasks) {
    const key = toDayKey(task.dueDate.toDate());
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      groups.set(key, { date: task.dueDate, tasks: [task] });
    }
  }

  return Array.from(groups.values()).map(({ date, tasks: t }) => ({
    date,
    label: isToday(date) ? "Today" : formatDate(date),
    tasks: t,
  }));
}
