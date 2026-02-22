export interface ExploreVisualAid {
  id: string;
  title: string;
  imageUrl: string;
  pageUrl: string;
  source: "Wikipedia";
  matchedTarget?: string;
}

export interface ExploreVisualAidInput {
  topic: string;
  summary?: string | null;
  sectionTitles?: string[];
  corePoints?: string[];
}

const STRONG_VISUAL_TERMS: readonly RegExp[] = [
  /\banatom(?:y|ical)?\b/i,
  /\bneuroanatom(?:y|ical)?\b/i,
  /\bgross anatomy\b/i,
  /\bmusculoskeletal\b/i,
  /\bdermatome\b/i,
  /\bmyotome\b/i,
  /\bcranial nerve(?:s)?\b/i,
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
  /\btriangle\b/i,
  /\bcanal\b/i,
];

const TARGET_PHRASE_RE =
  /\b([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3}\s+(?:nerve|artery|vein|muscle|bone|ligament|tendon|foramen|fossa|plexus|ganglion|canal|triangle|lobe|tract|sinus|valve))\b/gi;

const TITLE_NOISE_PATTERNS: readonly RegExp[] = [
  /\bdisambiguation\b/i,
  /\blist of\b/i,
  /\bcategory:/i,
  /\bhistory of\b/i,
  /\bhuman body\b/i,
  /\banatomical terminology\b/i,
];

const STRUCTURE_HEADWORDS = new Set([
  "nerve",
  "artery",
  "vein",
  "muscle",
  "bone",
  "ligament",
  "tendon",
  "foramen",
  "fossa",
  "plexus",
  "ganglion",
  "canal",
  "triangle",
  "lobe",
  "tract",
  "sinus",
  "valve",
]);

const TARGET_CONNECTORS = new Set([
  "and",
  "or",
  "with",
  "without",
  "of",
  "in",
  "on",
  "at",
  "for",
  "to",
  "from",
  "the",
  "a",
  "an",
  "assess",
  "evaluation",
  "evaluate",
  "management",
  "approach",
  "injury",
  "injuries",
  "deficit",
  "deficits",
]);

const TOKEN_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "anatomy",
  "anatomical",
  "medical",
  "study",
  "disease",
  "syndrome",
  "approach",
]);

interface WikipediaPage {
  pageid: number;
  title: string;
  fullurl?: string;
  thumbnail?: {
    source?: string;
    width?: number;
    height?: number;
  };
}

interface WikipediaQueryResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

interface VisualAidCandidate extends ExploreVisualAid {
  score: number;
}

interface QueryPlan {
  target: string;
  query: string;
}

function toInput(input: string | ExploreVisualAidInput): ExploreVisualAidInput {
  return typeof input === "string" ? { topic: input } : input;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !TOKEN_STOPWORDS.has(w));
}

function cleanTarget(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "");
}

function tightenStructurePhrase(value: string): string {
  const words = cleanTarget(value)
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";

  const structureIdx = (() => {
    for (let i = words.length - 1; i >= 0; i--) {
      const token = words[i].toLowerCase();
      if (STRUCTURE_HEADWORDS.has(token)) return i;
    }
    return -1;
  })();

  if (structureIdx === -1) return cleanTarget(value);

  const picked: string[] = [words[structureIdx]];
  let includedBefore = 0;
  for (let i = structureIdx - 1; i >= 0; i--) {
    const token = words[i];
    const lower = token.toLowerCase();
    if (TARGET_CONNECTORS.has(lower)) break;
    picked.unshift(token);
    includedBefore++;
    if (includedBefore >= 3) break;
  }

  return cleanTarget(picked.join(" "));
}

function countPatternHits(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

function topicLooksSpecific(topic: string): boolean {
  if (!topic.trim()) return false;
  if (countPatternHits(topic, STRUCTURE_TERMS) > 0) return true;
  return /\b(anatomy|neuroanatomy|cranial nerve(?:s)?)\b/i.test(topic);
}

export function shouldShowExploreVisualAids(input: ExploreVisualAidInput): boolean {
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

export function extractExploreVisualTargets(
  input: ExploreVisualAidInput,
  maxTargets = 4
): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];

  const pushTarget = (value: string) => {
    const cleaned = tightenStructurePhrase(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(cleaned);
  };

  const topic = input.topic.trim();
  if (topicLooksSpecific(topic)) {
    pushTarget(topic);
  }

  const combined = [
    input.topic,
    input.summary || "",
    ...(input.sectionTitles || []),
    ...(input.corePoints || []),
  ].join(" ");

  for (const match of combined.matchAll(TARGET_PHRASE_RE)) {
    const phrase = match[1];
    if (phrase) {
      pushTarget(phrase);
    }
  }

  if (targets.length === 0 && topic) {
    pushTarget(topic);
  }

  return targets.slice(0, maxTargets);
}

function buildQueryPlan(input: ExploreVisualAidInput, maxTargets = 3): QueryPlan[] {
  const targets = extractExploreVisualTargets(input, maxTargets);
  if (targets.length === 0) return [];

  const plan: QueryPlan[] = [];
  for (const target of targets) {
    const hasAnatomy = /\banatom/i.test(target);
    const query = hasAnatomy
      ? `intitle:"${target}" diagram`
      : `intitle:"${target}" anatomy diagram`;
    plan.push({ target, query });
  }
  return plan;
}

export function buildExploreVisualAidQueries(input: string | ExploreVisualAidInput): string[] {
  return buildQueryPlan(toInput(input)).map((item) => item.query);
}

function scorePageTitle(title: string, target: string, topicWords: string[]): number {
  const lowerTitle = title.toLowerCase();
  const lowerTarget = target.toLowerCase();

  let score = 0;
  if (lowerTitle.includes(lowerTarget)) {
    score += 8;
  }

  const targetWords = normalizeWords(target);
  for (const token of targetWords) {
    if (lowerTitle.includes(token)) score += 2;
  }

  for (const token of topicWords.slice(0, 8)) {
    if (lowerTitle.includes(token)) score += 1;
  }

  for (const noise of TITLE_NOISE_PATTERNS) {
    if (noise.test(title)) score -= 5;
  }

  return score;
}

async function fetchWikipediaQuery(
  query: string,
  target: string,
  topicWords: string[],
  limit: number
): Promise<VisualAidCandidate[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(Math.max(limit, 4)),
    gsrnamespace: "0",
    gsrsort: "relevance",
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
  const candidates: VisualAidCandidate[] = [];

  for (const page of pages) {
    const imageUrl = page.thumbnail?.source || "";
    const pageUrl = page.fullurl || "";
    const width = page.thumbnail?.width || 0;
    const height = page.thumbnail?.height || 0;
    if (!imageUrl || !pageUrl) continue;
    if (width < 220 || height < 160) continue;

    const score = scorePageTitle(page.title, target, topicWords);
    if (score < 3) continue;

    candidates.push({
      id: `wiki-${page.pageid}`,
      title: page.title,
      imageUrl,
      pageUrl,
      source: "Wikipedia",
      matchedTarget: target,
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function selectDiverseCandidates(candidates: VisualAidCandidate[], limit: number): ExploreVisualAid[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: VisualAidCandidate[] = [];
  const usedIds = new Set<string>();
  const usedTargets = new Set<string>();

  // Pass 1: one result per target when possible.
  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (usedIds.has(item.id)) continue;
    if (item.matchedTarget && usedTargets.has(item.matchedTarget.toLowerCase())) continue;

    selected.push(item);
    usedIds.add(item.id);
    if (item.matchedTarget) usedTargets.add(item.matchedTarget.toLowerCase());
  }

  // Pass 2: fill remaining slots by global relevance.
  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (usedIds.has(item.id)) continue;
    selected.push(item);
    usedIds.add(item.id);
  }

  return selected.map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    pageUrl: item.pageUrl,
    source: item.source,
    matchedTarget: item.matchedTarget,
  }));
}

export async function fetchExploreVisualAids(
  input: string | ExploreVisualAidInput,
  limit = 6
): Promise<ExploreVisualAid[]> {
  const resolved = toInput(input);
  const plan = buildQueryPlan(resolved, 3);
  if (plan.length === 0) return [];

  const topicWords = normalizeWords(resolved.topic);
  const dedupeByPage = new Set<string>();
  const allCandidates: VisualAidCandidate[] = [];

  for (const item of plan) {
    try {
      const batch = await fetchWikipediaQuery(item.query, item.target, topicWords, limit);
      for (const candidate of batch) {
        if (dedupeByPage.has(candidate.pageUrl)) continue;
        dedupeByPage.add(candidate.pageUrl);
        allCandidates.push(candidate);
      }
    } catch {
      // Ignore transient fetch failures and continue with other targets.
    }
  }

  return selectDiverseCandidates(allCandidates, limit);
}
