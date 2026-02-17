import type { TaskModel } from "@/lib/types/task";
import type { SectionModel } from "@/lib/types/section";

/**
 * Regex matching generic section/page/slide titles produced by the scheduler
 * fallback, e.g. "Section 1", "Pages 1-10", "Slides 5–8", "Part 2".
 */
const GENERIC_RE =
  /\b(?:pages?|slides?|section|chapter|part)\s*\d+(?:\s*[-–—to]+\s*\d+)?\b|\b(?:untitled|unknown\s+section)\b/i;

const TYPE_PREFIX_RE = /^(study|questions|review)\s*:\s*/i;

function isGeneric(title: string): boolean {
  const cleaned = title.trim();
  if (!cleaned) return true;
  // Fully generic: entire string matches the pattern
  if (GENERIC_RE.test(cleaned)) return true;
  // Bare "Section N" fallback from scheduler
  if (/^section\s+\d+$/i.test(cleaned)) return true;
  return false;
}

function pickBestFromSection(section: SectionModel): string | null {
  // 1. Section title (if not generic itself)
  if (section.title && !isGeneric(section.title)) {
    return section.title.trim();
  }

  // 2. Topic tags
  const tags = section.topicTags?.filter((t) => t && !isGeneric(t)) ?? [];
  if (tags.length > 0) {
    const primary = tags[0];
    const secondary = tags.find(
      (t) => t.toLowerCase() !== primary.toLowerCase()
    );
    return secondary ? `${primary} – ${secondary}` : primary;
  }

  // 3. Blueprint: keyConcepts → termsToDefine → learningObjectives → highYieldPoints
  const bp = section.blueprint;
  if (bp) {
    const sources = [
      bp.keyConcepts,
      bp.termsToDefine,
      bp.learningObjectives,
      bp.highYieldPoints,
    ];
    for (const source of sources) {
      const items = source?.filter((v) => v && !isGeneric(v)) ?? [];
      if (items.length > 0) {
        const primary = items[0].replace(/^(?:understand|describe|explain|identify|outline|review)\s+/i, "").trim();
        if (primary) return primary;
      }
    }
  }

  return null;
}

/**
 * Build a Map<sectionId, SectionModel> for quick lookups.
 */
export function buildSectionMap(
  sections: SectionModel[]
): Map<string, SectionModel> {
  const map = new Map<string, SectionModel>();
  for (const s of sections) map.set(s.id, s);
  return map;
}

/**
 * Strips the type prefix ("Study: ", "Questions: ", "Review: ") and returns
 * { prefix, body } so callers can recombine if needed.
 */
function splitPrefix(title: string): { prefix: string; body: string } {
  const match = title.match(TYPE_PREFIX_RE);
  if (match) {
    return { prefix: match[0], body: title.slice(match[0].length).trim() };
  }
  return { prefix: "", body: title.trim() };
}

/**
 * Resolve a task's display title using section data when the stored title is
 * generic (e.g. "Study: Section 1" → "Study: Cardiovascular Physiology").
 *
 * Falls back to the original task.title when no better title is available.
 */
export function resolveTaskTitle(
  task: TaskModel,
  sectionMap: Map<string, SectionModel>
): string {
  const { prefix, body } = splitPrefix(task.title);

  // Already has a specific title — keep it
  if (!isGeneric(body)) return task.title;

  // Try to resolve from linked section
  const sectionId = task.sectionIds?.[0];
  if (!sectionId) return task.title;

  const section = sectionMap.get(sectionId);
  if (!section) return task.title;

  const better = pickBestFromSection(section);
  if (!better) return task.title;

  return prefix ? `${prefix}${better}` : better;
}

/**
 * Resolve body only (without the type prefix). Used where the type badge is
 * shown separately (e.g. TodayChecklist).
 */
export function resolveTaskBody(
  task: TaskModel,
  sectionMap: Map<string, SectionModel>
): string {
  const { body } = splitPrefix(task.title);

  if (!isGeneric(body)) return body;

  const sectionId = task.sectionIds?.[0];
  if (!sectionId) return body;

  const section = sectionMap.get(sectionId);
  if (!section) return body;

  return pickBestFromSection(section) ?? body;
}
