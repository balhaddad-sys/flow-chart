const STORAGE_KEY = "medq_explore_topics_v1";
const MAX_ENTRIES = 25;

export interface ExploreHistoryEntry {
  topic: string;
  level: string;
  levelLabel: string;
  path: "learn" | "quiz";
  timestamp: number;
}

function entryKey(topic: string, level: string): string {
  return `${topic.trim().toLowerCase()}::${level.trim().toLowerCase()}`;
}

export function getExploreHistory(): ExploreHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e: unknown): e is ExploreHistoryEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as ExploreHistoryEntry).topic === "string" &&
          typeof (e as ExploreHistoryEntry).level === "string" &&
          typeof (e as ExploreHistoryEntry).timestamp === "number"
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function addExploreHistoryEntry(entry: Omit<ExploreHistoryEntry, "timestamp">): void {
  try {
    const existing = getExploreHistory();
    const key = entryKey(entry.topic, entry.level);
    const filtered = existing.filter((e) => entryKey(e.topic, e.level) !== key);
    const updated: ExploreHistoryEntry[] = [
      { ...entry, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function removeExploreHistoryEntry(topic: string, level: string): void {
  try {
    const existing = getExploreHistory();
    const key = entryKey(topic, level);
    const filtered = existing.filter((e) => entryKey(e.topic, e.level) !== key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // silently ignore
  }
}

export function clearExploreHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
