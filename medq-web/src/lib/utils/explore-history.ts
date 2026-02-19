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

// ── Pending session (survives navigation) ─────────────────────────────

const SESSION_KEY = "medq_explore_session_v1";
const SESSION_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface ExplorePendingSession {
  topic: string;
  level: string;
  path: "learn" | "quiz";
  backgroundJobId?: string;
  count?: number;
  startedAt: number;
}

export function savePendingSession(session: Omit<ExplorePendingSession, "startedAt">): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, startedAt: Date.now() }));
  } catch {
    // silently ignore
  }
}

export function updatePendingSession(updates: Partial<ExplorePendingSession>): void {
  try {
    const existing = getPendingSession();
    if (!existing) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...updates }));
  } catch {
    // silently ignore
  }
}

export function getPendingSession(): ExplorePendingSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExplorePendingSession;
    if (
      typeof parsed.topic !== "string" ||
      typeof parsed.level !== "string" ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.startedAt > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // silently ignore
  }
}
