/**
 * Text parsing, OCR cleaning, and study-guide derivation utilities
 * extracted from the study session page for modularity and testability.
 */
import type { SectionBlueprint } from "@/lib/types/section";

// ── OCR noise detection ──

const OCR_NOISE_RE =
  /copyright|all rights reserved|isbn|issn|printed in|library of congress|cataloging|publisher|page\s+[ivxlcdm\d]+|^\d{1,4}$/i;
const METADATA_LINE_RE =
  /^\d{1,2}\/\d{1,2}\/\d{2,4}|\.pdf\b|\.docx?\b|\.pptx?\b|sinauer|elsevier|mcgraw|springer|wiley|lippincott|saunders/i;

export function isOCRNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (OCR_NOISE_RE.test(t)) return true;
  if (METADATA_LINE_RE.test(t)) return true;
  if (/^[\d\s.•\-–—]+$/.test(t)) return true;
  return false;
}

/** Fix common OCR artifacts: hyphenated line-breaks, stray whitespace */
export function cleanOCR(text: string): string {
  return text
    .replace(/(\w)- (\w)/g, "$1$2")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Text block parsing ──

export interface TextBlock {
  type: "heading" | "paragraph";
  content: string;
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  if (isOCRNoise(t)) return false;
  if (t.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  if (t.length < 80 && !/[.!?:,;]$/.test(t) && /^[A-Z]/.test(t) && !t.includes("\u25A1")) return true;
  return false;
}

export function parseTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const raw = text.split(/\n\n+/);
  for (const chunk of raw) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (isOCRNoise(trimmed)) continue;
    if (isHeadingLine(trimmed) && !trimmed.includes("\n")) {
      blocks.push({ type: "heading", content: trimmed });
      continue;
    }
    const lines = trimmed.split("\n");
    if (lines.length >= 2 && isHeadingLine(lines[0]) && lines[0].length < 100) {
      blocks.push({ type: "heading", content: lines[0].trim() });
      const bodyLines = lines.slice(1).filter((l) => !isOCRNoise(l));
      if (bodyLines.length > 0) {
        blocks.push({ type: "paragraph", content: bodyLines.join(" ").trim() });
      }
      continue;
    }
    const cleanedLines = lines.filter((l) => !isOCRNoise(l));
    if (cleanedLines.length > 0) {
      blocks.push({ type: "paragraph", content: cleanedLines.join(" ").replace(/\n/g, " ") });
    }
  }
  return blocks;
}

// ── Note sections ──

export interface NoteSection {
  id: string;
  title: string;
  paragraphs: string[];
}

function sectionIdFromTitle(title: string, i: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
  return slug ? `sec-${slug}-${i}` : `sec-${i}`;
}

export function buildNoteSections(blocks: TextBlock[]): NoteSection[] {
  if (blocks.length === 0) return [];
  const sections: NoteSection[] = [];
  let currentTitle = "Core Notes";
  let currentParagraphs: string[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      if (currentParagraphs.length > 0) {
        sections.push({
          id: sectionIdFromTitle(currentTitle, sections.length),
          title: currentTitle,
          paragraphs: currentParagraphs,
        });
        currentParagraphs = [];
      }
      currentTitle = block.content;
      continue;
    }
    currentParagraphs.push(block.content);
  }

  if (currentParagraphs.length > 0) {
    sections.push({
      id: sectionIdFromTitle(currentTitle, sections.length),
      title: currentTitle,
      paragraphs: currentParagraphs,
    });
  }
  return sections;
}

// ── Deduplication ──

export function dedupe(strings: string[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of strings) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

// ── Source extraction ──

function splitSentences(text: string): string[] {
  const cleaned = cleanOCR(text);
  const all = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 220 && !s.includes("http"));
  const proper = all.filter((s) => /^[A-Z]/.test(s));
  return proper.length >= 3 ? proper : all;
}

export function deriveSourceSnippets(sectionText: string | null, max = 4): string[] {
  if (!sectionText) return [];
  const chunks = cleanOCR(sectionText)
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  const snippets: string[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    if (isOCRNoise(chunk)) continue;
    const sentences = chunk
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length >= 80 &&
          s.length <= 260 &&
          /^[A-Z]/.test(s) &&
          !isOCRNoise(s) &&
          !METADATA_LINE_RE.test(s)
      );
    for (const sentence of sentences) {
      const key = sentence.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(sentence);
      if (snippets.length >= max) return snippets;
    }
  }

  for (const chunk of chunks) {
    if (snippets.length >= max) break;
    if (isOCRNoise(chunk)) continue;
    const sentences = chunk
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 80 && s.length <= 260 && !isOCRNoise(s) && !METADATA_LINE_RE.test(s));
    for (const sentence of sentences) {
      const key = sentence.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(sentence);
      if (snippets.length >= max) return snippets;
    }
  }
  return snippets;
}

export function deriveSourceParagraphs(noteSections: NoteSection[], max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const section of noteSections) {
    for (const paragraph of section.paragraphs) {
      const value = paragraph.replace(/\s+/g, " ").trim();
      if (value.length < 80 || isOCRNoise(value)) continue;
      const cleaned = cleanOCR(value);
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function findBestParagraphIndex(snippet: string, paragraphs: string[]): number {
  if (!snippet || paragraphs.length === 0) return -1;
  const normSnippet = snippet.toLowerCase().replace(/\s+/g, " ").trim();
  const snippetHead = normSnippet.slice(0, 80);

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].toLowerCase().replace(/\s+/g, " ").trim();
    if (p.includes(normSnippet) || p.includes(snippetHead)) return i;
  }

  const snippetTokens = new Set(normSnippet.split(/\s+/).filter((t) => t.length > 3));
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const tokens = new Set(
      paragraphs[i]
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3)
    );
    let overlap = 0;
    for (const token of snippetTokens) {
      if (tokens.has(token)) overlap++;
    }
    if (overlap > bestScore) {
      bestScore = overlap;
      bestIdx = i;
    }
  }
  return bestScore >= 3 ? bestIdx : -1;
}

// ── Fallback guide derivation ──

export interface FallbackGuide {
  roadmap: string[];
  objectives: string[];
  highYield: string[];
  examAngles: string[];
  recallPrompts: string[];
}

function isUsefulTopic(topic: string): boolean {
  const t = topic.trim();
  if (!t || t.length < 4 || t.length > 100) return false;
  if (isOCRNoise(t)) return false;
  if (/^(chapter|edited|edition|third|fourth|fifth|sixth)\b/i.test(t)) return false;
  if (/^[A-Z]+$/.test(t) && t.length < 15) return false;
  if (/\b(?:pages?|slides?|section)\s*\d+(?:\s*[-–—]\s*\d+)?\s*$/i.test(t)) return false;
  return true;
}

export function deriveFallbackGuide(
  sectionTitle: string | undefined,
  noteSections: NoteSection[],
  blocks: TextBlock[],
  blueprint?: SectionBlueprint | null,
): FallbackGuide {
  if (blueprint) {
    const bpObjectives = Array.isArray(blueprint.learningObjectives) ? blueprint.learningObjectives.filter(Boolean).map(cleanOCR) : [];
    const bpHighYield = Array.isArray(blueprint.highYieldPoints) ? blueprint.highYieldPoints.filter(Boolean).map(cleanOCR) : [];
    const bpConcepts = Array.isArray(blueprint.keyConcepts) ? blueprint.keyConcepts.filter(Boolean).map(cleanOCR) : [];

    if (bpObjectives.length > 0 || bpHighYield.length > 0) {
      const objKeys = new Set(bpObjectives.map((s) => s.toLowerCase()));
      const uniqueHighYield = bpHighYield.filter((s) => !objKeys.has(s.toLowerCase()));
      return {
        roadmap: bpConcepts.length > 0 ? bpConcepts.slice(0, 5) : dedupe([sectionTitle ?? "Section overview"], 3),
        objectives: bpObjectives.slice(0, 6),
        highYield: uniqueHighYield.slice(0, 5),
        examAngles: [],
        recallPrompts: [],
      };
    }
  }

  const roadmap = dedupe(
    noteSections
      .map((s) => s.title)
      .filter((t) => t && t.toLowerCase() !== "core notes" && isUsefulTopic(t))
  );

  const paragraphText = blocks
    .filter((b) => b.type === "paragraph" && !isOCRNoise(b.content))
    .map((b) => b.content)
    .join(" ");

  const keySentences = dedupe(splitSentences(paragraphText), 8);
  const focusTopics = dedupe(
    [
      ...(sectionTitle && isUsefulTopic(sectionTitle) ? [sectionTitle] : []),
      ...roadmap,
    ],
    5
  );

  const objectives: string[] = [];
  const usedSentenceKeys = new Set<string>();

  if (focusTopics.length > 0) {
    for (const topic of focusTopics.slice(0, 3)) {
      objectives.push(`Understand the mechanism and clinical relevance of ${topic}.`);
    }
  }
  for (const sentence of keySentences) {
    if (objectives.length >= 5) break;
    objectives.push(sentence);
    usedSentenceKeys.add(sentence.toLowerCase());
  }
  if (objectives.length === 0 && keySentences.length > 0) {
    for (const s of keySentences.slice(0, 4)) {
      objectives.push(s);
      usedSentenceKeys.add(s.toLowerCase());
    }
  }

  const highYield = keySentences.filter(
    (s) => !usedSentenceKeys.has(s.toLowerCase())
  );

  const examAngles: string[] = [];
  for (const topic of focusTopics.slice(0, 2)) {
    examAngles.push(`Most testable angle: ${topic} \u2014 identify the single decisive clue.`);
  }

  const recallPrompts = dedupe(
    [
      ...focusTopics
        .slice(0, 2)
        .map((topic) => `Explain ${topic} from mechanism to first-line management in 60 seconds.`),
      ...focusTopics
        .slice(0, 2)
        .map((topic) => `What finding would make you choose or reject ${topic} in a clinical stem?`),
    ],
    4
  );

  return {
    roadmap: roadmap.length > 0 ? roadmap : (focusTopics.length > 0 ? focusTopics : dedupe([sectionTitle ?? "Section overview"], 3)),
    objectives: dedupe(objectives, 6),
    highYield,
    examAngles: dedupe(examAngles, 4),
    recallPrompts,
  };
}
