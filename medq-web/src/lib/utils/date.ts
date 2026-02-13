import { Timestamp } from "firebase/firestore";

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
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isSameDay(a: Timestamp, b: Timestamp): boolean {
  const da = a.toDate();
  const db = b.toDate();
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function groupTasksByDay<T extends { dueDate: Timestamp }>(
  tasks: T[]
): { date: Timestamp; label: string; tasks: T[] }[] {
  const groups: Map<string, { date: Timestamp; tasks: T[] }> = new Map();

  for (const task of tasks) {
    const d = task.dueDate.toDate();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
