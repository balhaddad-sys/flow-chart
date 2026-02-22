export interface ExploreVisualAid {
  id: string;
  title: string;
  imageUrl: string;
  pageUrl: string;
  source: "Wikipedia";
}

const STRONG_VISUAL_TERMS: readonly RegExp[] = [
  /\banatom(?:y|ical)?\b/i,
  /\bneuroanatom(?:y|ical)?\b/i,
  /\bgross anatomy\b/i,
  /\bmusculoskeletal\b/i,
  /\bdermatome\b/i,
  /\bmyotome\b/i,
  /\bcranial nerve\b/i,
];

const STRUCTURE_TERMS: readonly RegExp[] = [
  /\bnerve\b/i,
  /\bplexus\b/i,
  /\bartery\b/i,
  /\bvein\b/i,
  /\bmuscle\b/i,
  /\bbone\b/i,
  /\bligament\b/i,
  /\btendon\b/i,
  /\bjoint\b/i,
  /\bforamen\b/i,
  /\bfossa\b/i,
  /\borgan\b/i,
];

interface ShowVisualAidInput {
  topic: string;
  summary?: string | null;
  sectionTitles?: string[];
  corePoints?: string[];
}

function countPatternHits(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

export function shouldShowExploreVisualAids(input: ShowVisualAidInput): boolean {
  const combined = [
    input.topic,
    input.summary || "",
    ...(input.sectionTitles || []),
    ...(input.corePoints || []),
  ]
    .join(" ")
    .trim();

  if (!combined) return false;

  const strongHits = countPatternHits(combined, STRONG_VISUAL_TERMS);
  if (strongHits > 0) return true;

  // Fallback signal: multiple structure keywords usually implies a visual-heavy topic.
  const structureHits = countPatternHits(combined, STRUCTURE_TERMS);
  return structureHits >= 2;
}

export function buildExploreVisualAidQueries(topic: string): string[] {
  const cleaned = topic.trim();
  if (!cleaned) return [];

  const lower = cleaned.toLowerCase();
  const withAnatomy = /\banatom/i.test(lower) ? cleaned : `${cleaned} anatomy`;

  return Array.from(
    new Set([
      `${withAnatomy} diagram`,
      `${withAnatomy} illustration`,
      `${cleaned} labeled structures`,
    ])
  );
}

interface WikipediaPage {
  pageid: number;
  title: string;
  fullurl?: string;
  thumbnail?: {
    source?: string;
  };
}

interface WikipediaQueryResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

async function fetchWikipediaQuery(query: string, limit: number): Promise<ExploreVisualAid[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "900",
    inprop: "url",
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Wikipedia request failed (${response.status})`);
  }

  const payload = (await response.json()) as WikipediaQueryResponse;
  const pages = Object.values(payload.query?.pages || {});

  return pages
    .map((page) => {
      const imageUrl = page.thumbnail?.source || "";
      const pageUrl = page.fullurl || "";
      if (!imageUrl || !pageUrl) return null;

      // Skip obvious non-anatomy assets.
      if (/\blogo\b/i.test(page.title)) return null;

      return {
        id: `wiki-${page.pageid}`,
        title: page.title,
        imageUrl,
        pageUrl,
        source: "Wikipedia" as const,
      };
    })
    .filter((item): item is ExploreVisualAid => Boolean(item));
}

export async function fetchExploreVisualAids(
  topic: string,
  limit = 6
): Promise<ExploreVisualAid[]> {
  const queries = buildExploreVisualAidQueries(topic);
  if (queries.length === 0) return [];

  const dedupe = new Set<string>();
  const merged: ExploreVisualAid[] = [];

  for (const query of queries) {
    try {
      const batch = await fetchWikipediaQuery(query, limit);
      for (const item of batch) {
        if (dedupe.has(item.imageUrl)) continue;
        dedupe.add(item.imageUrl);
        merged.push(item);
        if (merged.length >= limit) {
          return merged.slice(0, limit);
        }
      }
    } catch {
      // Ignore transient fetch failures and continue with other queries.
    }
  }

  return merged.slice(0, limit);
}

