"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  BookOpen,
  Target,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Clock,
  BrainCircuit,
  Sparkles,
  MessageCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTimerStore } from "@/lib/stores/timer-store";
import { updateTask } from "@/lib/firebase/firestore";
import { getTextBlob } from "@/lib/firebase/storage";
import * as fn from "@/lib/firebase/functions";
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";
import type { SectionModel, SectionBlueprint } from "@/lib/types/section";

interface AISummary {
  summary: string;
  keyPoints: string[];
  mnemonics: string[];
}

interface NoteSection {
  id: string;
  title: string;
  paragraphs: string[];
}

interface FallbackGuide {
  roadmap: string[];
  objectives: string[];
  highYield: string[];
  examAngles: string[];
  recallPrompts: string[];
}

const OCR_NOISE_RE =
  /copyright|all rights reserved|isbn|issn|printed in|library of congress|cataloging|publisher|page\s+[ivxlcdm\d]+|^\d{1,4}$/i;
const METADATA_LINE_RE =
  /^\d{1,2}\/\d{1,2}\/\d{2,4}|\.pdf\b|\.docx?\b|\.pptx?\b|sinauer|elsevier|mcgraw|springer|wiley|lippincott|saunders/i;

function isOCRNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (OCR_NOISE_RE.test(t)) return true;
  if (METADATA_LINE_RE.test(t)) return true;
  if (/^[\d\s.•\-–—]+$/.test(t)) return true;
  return false;
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  if (isOCRNoise(t)) return false;
  if (t.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  if (t.length < 80 && !/[.!?:,;]$/.test(t) && /^[A-Z]/.test(t) && !t.includes("□")) return true;
  return false;
}

function parseTextBlocks(text: string) {
  const blocks: { type: "heading" | "paragraph"; content: string }[] = [];
  const raw = text.split(/\n\n+/);
  for (const chunk of raw) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    // Skip OCR noise paragraphs entirely
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
    // Filter noise lines within paragraphs
    const cleanedLines = lines.filter((l) => !isOCRNoise(l));
    if (cleanedLines.length > 0) {
      blocks.push({ type: "paragraph", content: cleanedLines.join(" ").replace(/\n/g, " ") });
    }
  }
  return blocks;
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

function buildNoteSections(blocks: { type: "heading" | "paragraph"; content: string }[]): NoteSection[] {
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

function dedupe(strings: string[], max = 6): string[] {
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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 220 && !s.includes("http"));
}

function deriveSourceSnippets(sectionText: string | null, max = 4): string[] {
  if (!sectionText) return [];

  const chunks = sectionText
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
    const fallback = chunk.slice(0, 220).trim();
    if (fallback.length < 80) continue;
    const key = fallback.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    snippets.push(fallback);
  }

  return snippets;
}

function deriveSourceParagraphs(noteSections: NoteSection[], max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const section of noteSections) {
    for (const paragraph of section.paragraphs) {
      const value = paragraph
        .replace(/\s+/g, " ")
        .trim();
      if (value.length < 80 || isOCRNoise(value)) continue;

      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
      if (out.length >= max) return out;
    }
  }

  return out;
}

function findBestParagraphIndex(snippet: string, paragraphs: string[]): number {
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

function isUsefulTopic(topic: string): boolean {
  const t = topic.trim();
  if (!t || t.length < 4 || t.length > 100) return false;
  if (isOCRNoise(t)) return false;
  // Filter out book titles, author names, edition labels
  if (/^(chapter|edited|edition|third|fourth|fifth|sixth)\b/i.test(t)) return false;
  if (/^[A-Z]+$/.test(t) && t.length < 15) return false; // Single uppercase word like "NEUROSCIENCE"
  // Filter out generic page/slide/section ranges like "Pages 11-20" or "Neuroscience: Pages 11-20"
  if (/\b(?:pages?|slides?|section)\s*\d+(?:\s*[-–—]\s*\d+)?\s*$/i.test(t)) return false;
  return true;
}

function deriveFallbackGuide(
  sectionTitle: string | undefined,
  noteSections: NoteSection[],
  blocks: { type: "heading" | "paragraph"; content: string }[],
  blueprint?: SectionBlueprint | null,
): FallbackGuide {
  // ── If blueprint has real data, prefer it over templates ──
  if (blueprint) {
    const bpObjectives = Array.isArray(blueprint.learningObjectives) ? blueprint.learningObjectives.filter(Boolean) : [];
    const bpHighYield = Array.isArray(blueprint.highYieldPoints) ? blueprint.highYieldPoints.filter(Boolean) : [];
    const bpConcepts = Array.isArray(blueprint.keyConcepts) ? blueprint.keyConcepts.filter(Boolean) : [];
    const bpTraps = Array.isArray(blueprint.commonTraps) ? blueprint.commonTraps.filter(Boolean) : [];

    if (bpObjectives.length > 0 || bpHighYield.length > 0) {
      return {
        roadmap: bpConcepts.length > 0 ? bpConcepts.slice(0, 5) : dedupe([sectionTitle ?? "Section overview"], 3),
        objectives: bpObjectives.slice(0, 6),
        highYield: bpHighYield.slice(0, 5),
        examAngles: bpTraps.slice(0, 4),
        recallPrompts: [],
      };
    }
  }

  // ── Derive from section headings and content ──
  const roadmap = dedupe(
    noteSections
      .map((s) => s.title)
      .filter((t) => t && t.toLowerCase() !== "core notes" && isUsefulTopic(t))
  );

  const paragraphText = blocks
    .filter((b) => b.type === "paragraph" && !isOCRNoise(b.content))
    .map((b) => b.content)
    .join(" ");

  const keySentences = dedupe(splitSentences(paragraphText), 5);
  const focusTopics = dedupe(
    [
      ...(sectionTitle && isUsefulTopic(sectionTitle) ? [sectionTitle] : []),
      ...roadmap,
    ],
    5
  );

  // Use actual content sentences as objectives instead of template fill-ins
  const objectives: string[] = [];
  if (focusTopics.length > 0) {
    // Only use real topic names (not page ranges) for objectives
    for (const topic of focusTopics.slice(0, 3)) {
      objectives.push(`Understand the mechanism and clinical relevance of ${topic}.`);
    }
  }
  // Fill remaining slots with actual key sentences from the content
  for (const sentence of keySentences) {
    if (objectives.length >= 5) break;
    objectives.push(sentence);
  }
  if (objectives.length === 0 && keySentences.length > 0) {
    objectives.push(...keySentences.slice(0, 4));
  }

  const examAngles: string[] = [];
  for (const topic of focusTopics.slice(0, 2)) {
    examAngles.push(`Most testable angle: ${topic} — identify the single decisive clue.`);
  }
  if (keySentences.length > 0 && examAngles.length < 4) {
    examAngles.push(`Anchor fact: ${keySentences[0]}`);
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
    highYield: keySentences,
    examAngles: dedupe(examAngles, 4),
    recallPrompts,
  };
}

export default function StudySessionPage({
  params,
}: {
  params: Promise<{ taskId: string; sectionId: string }>;
}) {
  const { taskId, sectionId } = use(params);
  const router = useRouter();
  const { user, uid } = useAuth();
  const { seconds, isRunning, start, pause, reset, getFormatted } = useTimerStore();
  const [section, setSection] = useState<SectionModel | null>(null);
  const [sectionText, setSectionText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeSourceParagraphIndex, setActiveSourceParagraphIndex] = useState<number | null>(null);
  const sourceParagraphRefs = useRef<Record<number, HTMLLIElement | null>>({});

  // Ask AI state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid, "sections", sectionId), (snap) => {
      if (snap.exists()) {
        setSection({ ...snap.data(), id: snap.id } as SectionModel);
      }
    });
    return unsub;
  }, [uid, sectionId]);

  useEffect(() => {
    if (!section?.textBlobPath) return;
    let cancelled = false;
    setTextLoading(true);
    setTextError(null);
    (async () => {
      try {
        const text = await getTextBlob(section.textBlobPath);
        if (!cancelled) setSectionText(text);
      } catch (error) {
        if (!cancelled) {
          setSectionText(null);
          setTextError(error instanceof Error ? error.message : "Failed to load section text.");
        }
      } finally {
        if (!cancelled) setTextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section?.textBlobPath]);

  useEffect(() => {
    start();
    return () => { pause(); reset(); };
  }, [start, pause, reset]);

  const textBlocks = useMemo(() => {
    if (!sectionText) return [];
    return parseTextBlocks(sectionText);
  }, [sectionText]);

  const noteSections = useMemo(() => {
    const built = buildNoteSections(textBlocks);
    if (built.length > 0) return built;
    if (!sectionText?.trim()) return [];
    return [
      {
        id: "sec-core-notes-0",
        title: "Core Notes",
        paragraphs: [sectionText.replace(/\s+/g, " ").trim()],
      },
    ];
  }, [textBlocks, sectionText]);

  const fallbackGuide = useMemo(
    () => deriveFallbackGuide(section?.title, noteSections, textBlocks, section?.blueprint),
    [section?.title, noteSections, textBlocks, section?.blueprint]
  );
  const sourceSnippets = useMemo(
    () => deriveSourceSnippets(sectionText),
    [sectionText]
  );
  const sourceParagraphs = useMemo(() => {
    const paragraphs = deriveSourceParagraphs(noteSections);
    // Cross-deduplicate: remove paragraphs that substantially overlap with snippets
    const snippetKeys = new Set(sourceSnippets.map((s) => s.toLowerCase().replace(/\s+/g, " ").slice(0, 80)));
    return paragraphs.filter((p) => {
      const pKey = p.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      return !snippetKeys.has(pKey);
    });
  }, [noteSections, sourceSnippets]);
  const snippetTargets = useMemo(
    () =>
      sourceSnippets.map((snippet) => ({
        snippet,
        paragraphIndex: findBestParagraphIndex(snippet, sourceParagraphs),
      })),
    [sourceSnippets, sourceParagraphs]
  );

  const handleSnippetJump = useCallback((paragraphIndex: number) => {
    if (paragraphIndex < 0) return;
    setActiveSourceParagraphIndex(paragraphIndex);
    requestAnimationFrame(() => {
      const el = sourceParagraphRefs.current[paragraphIndex];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const generateSummary = useCallback(async () => {
    if (!sectionText || !section?.title || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const input = { sectionText: sectionText.slice(0, 8000), title: section.title };
      try {
        const data = await fn.generateSectionSummary(input);
        if (data?.summary || data?.keyPoints?.length || data?.mnemonics?.length) {
          setSummary(data);
          return;
        }
      } catch { /* fall through */ }

      const idToken = await user?.getIdToken();
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "Failed to generate summary.");
      }
      setSummary(json.data as AISummary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate summary.";
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [sectionText, section?.title, summaryLoading, user]);

  // Auto-generate notes when section text loads
  useEffect(() => {
    if (sectionText && section?.title && !summary && !summaryLoading && !summaryError) {
      generateSummary();
    }
  }, [sectionText, section?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAskAI() {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    if (!uid || !section?.courseId) {
      toast.error("Unable to send — course data not loaded yet.");
      return;
    }

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      // Create thread on first message
      let threadId = chatThreadId;
      if (!threadId) {
        try {
          const ref = await addDoc(collection(db, "users", uid, "chatThreads"), {
            courseId: section.courseId,
            title: `Study: ${section.title || "Section"}`,
            messageCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          threadId = ref.id;
          setChatThreadId(threadId);
        } catch (threadErr) {
          console.error("Failed to create chat thread:", threadErr);
          throw new Error("Could not start a conversation. Please try again.");
        }
      }

      const result = await fn.sendChatMessage({
        threadId,
        message: question,
        courseId: section.courseId,
      });

      setChatMessages((prev) => [...prev, { role: "assistant", content: result.response }]);
    } catch (error) {
      console.error("Ask AI error:", error);
      const message = error instanceof Error ? error.message : "Failed to get response.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleComplete() {
    if (!uid) return;
    pause();
    const minutes = Math.ceil(seconds / 60);
    await updateTask(uid, taskId, { status: "DONE", actualMinutes: minutes });
    reset();
    toast.success("Session complete!");
    router.push("/today/plan");
  }

  const formatted = getFormatted();
  const bp = section?.blueprint;
  const hasBlueprintGuide = !!bp && (
    (bp.learningObjectives?.length ?? 0) > 0 ||
    (bp.keyConcepts?.length ?? 0) > 0 ||
    (bp.highYieldPoints?.length ?? 0) > 0
  );
  const hasFallbackGuide =
    fallbackGuide.roadmap.length > 0 ||
    fallbackGuide.objectives.length > 0 ||
    fallbackGuide.highYield.length > 0 ||
    fallbackGuide.examAngles.length > 0 ||
    fallbackGuide.recallPrompts.length > 0;
  const hasGuide = hasBlueprintGuide || hasFallbackGuide;
  const defaultTab = hasGuide ? "guide" : "notes";

  return (
    <div className="flex flex-col">
      {/* ── Sticky header ── sits below the CourseSwitcherBar (min-h-12) */}
      <div className="sticky top-12 z-10 border-b border-border/50 bg-background/80 backdrop-blur-2xl">
        {/* Row 1: back + title + timer */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs font-medium truncate px-2">
              {section?.title ?? "Loading..."}
            </p>
          </div>

          {/* Timer pill */}
          <div className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1 transition-colors ${
              seconds > 3600 ? "bg-red-500/15 text-red-600 dark:text-red-400" :
              seconds > 1800 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
              "bg-muted/80"
            }`}>
              <Clock className="h-3 w-3" />
              <span className="font-mono text-xs tabular-nums font-medium min-w-[2.5rem] text-center">
                {formatted}
              </span>
              {isRunning ? (
                <button onClick={pause} className="rounded-full p-1 hover:bg-background/60 transition-colors">
                  <Pause className="h-3 w-3" />
                </button>
              ) : (
                <button onClick={start} className="rounded-full p-1 hover:bg-background/60 transition-colors">
                  <Play className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button size="sm" className="h-7 rounded-full text-xs px-3 ml-1" onClick={handleComplete}>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Done
            </Button>
          </div>
        </div>

        {/* Row 2: topic tags */}
        {section && (section.estMinutes || (section.topicTags && section.topicTags.length > 0)) && (
          <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-none">
            {section.estMinutes && (
              <Badge variant="outline" className="text-[10px] shrink-0 rounded-full">
                ~{section.estMinutes} min
              </Badge>
            )}
            {section.topicTags?.slice(0, 5).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] shrink-0 rounded-full">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-8 sm:px-6">
        <Tabs defaultValue={defaultTab} className="space-y-5">
          {/* Tab selector */}
          <TabsList className="grid w-full grid-cols-3 h-10 rounded-xl p-1">
            <TabsTrigger value="guide" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <Lightbulb className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="ask" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <MessageCircle className="h-3.5 w-3.5" />
              Ask AI
            </TabsTrigger>
          </TabsList>

          {/* ─── Guide Tab ─── */}
          <TabsContent value="guide" className="space-y-4 mt-0">
            {hasBlueprintGuide ? (
              <>
                {bp.learningObjectives?.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950/60">
                        <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Learning Objectives</h3>
                    </div>
                    <ul className="space-y-3">
                      {bp.learningObjectives.map((obj, i) => (
                        <li key={i} className="flex gap-3 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-blue-500/60" />
                          <span className="text-foreground/80">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bp.keyConcepts?.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <h3 className="text-sm font-semibold mb-3">Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {bp.keyConcepts.map((concept, i) => (
                        <span key={i} className="inline-flex rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {bp.highYieldPoints?.length > 0 && (
                  <div className="rounded-2xl border border-green-200/80 bg-green-50/50 p-4 sm:p-5 dark:border-green-900/50 dark:bg-green-950/20">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-green-100 dark:bg-green-900/40">
                        <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-sm font-semibold">High-Yield Points</h3>
                    </div>
                    <ul className="space-y-3">
                      {bp.highYieldPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-green-500/60" />
                          <span className="text-foreground/80">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bp.commonTraps?.length > 0 && (
                  <div className="rounded-2xl border border-orange-200/80 bg-orange-50/50 p-4 sm:p-5 dark:border-orange-900/50 dark:bg-orange-950/20">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-orange-100 dark:bg-orange-900/40">
                        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Common Traps</h3>
                    </div>
                    <ul className="space-y-3">
                      {bp.commonTraps.map((trap, i) => (
                        <li key={i} className="flex gap-3 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-orange-500/60" />
                          <span className="text-foreground/80">{trap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bp.termsToDefine?.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <h3 className="text-sm font-semibold mb-3">Terms to Know</h3>
                    <div className="flex flex-wrap gap-2">
                      {bp.termsToDefine.map((term, i) => (
                        <span key={i} className="inline-flex rounded-full border px-3 py-1.5 text-xs font-medium">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {summary?.summary && (
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/45 p-4 sm:p-5 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
                        <BrainCircuit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Clinical Synthesis</h3>
                    </div>
                    <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/85">{summary.summary}</p>
                  </div>
                )}

                {(fallbackGuide.examAngles.length > 0 || fallbackGuide.recallPrompts.length > 0) && (
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/45 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Reasoning Drills</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {fallbackGuide.examAngles.slice(0, 3).map((item, i) => (
                        <li key={`angle_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">
                          {item}
                        </li>
                      ))}
                      {fallbackGuide.recallPrompts.slice(0, 3).map((prompt, i) => (
                        <li key={`prompt_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : hasFallbackGuide ? (
              <div className="space-y-4">
                {fallbackGuide.objectives.length > 0 && (
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/45 p-4 sm:p-5 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
                        <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold">What to Master</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {fallbackGuide.objectives.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500/60" />
                          <span className="text-foreground/85">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fallbackGuide.highYield.length > 0 && (
                  <div className="rounded-2xl border border-green-200/80 bg-green-50/45 p-4 sm:p-5 dark:border-green-900/50 dark:bg-green-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/50">
                        <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-sm font-semibold">High-Yield Highlights</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {fallbackGuide.highYield.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-500/60" />
                          <span className="text-foreground/85">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fallbackGuide.examAngles.length > 0 && (
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/45 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                        <BrainCircuit className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Exam Angles</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {fallbackGuide.examAngles.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500/60" />
                          <span className="text-foreground/85">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted mb-4">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No study guide available</p>
                <p className="mt-1.5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  This section hasn&apos;t been analyzed yet. Check the Notes tab for the full text.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ─── Notes Tab (AI-generated study notes) ─── */}
          <TabsContent value="notes" className="space-y-4 mt-0">
            {summaryLoading ? (
              <div className="space-y-4 py-2">
                <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-sm font-medium">Generating study notes...</p>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[92%]" />
                  <Skeleton className="h-4 w-[85%]" />
                </div>
                <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[90%]" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ) : summary ? (
              <>
                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">Overview</h3>
                  </div>
                  <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/80">
                    {summary.summary}
                  </p>
                </div>

                {summary.keyPoints?.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950/60">
                        <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Key Points</h3>
                    </div>
                    <ul className="space-y-3">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-blue-500/60" />
                          <span className="text-foreground/80">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.mnemonics?.length > 0 && (
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-900/40">
                        <BrainCircuit className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-sm font-semibold">Memory Aids</h3>
                    </div>
                    <ul className="space-y-2">
                      {summary.mnemonics.map((m, i) => (
                        <li key={i} className="text-[13px] sm:text-sm leading-relaxed text-violet-700 dark:text-violet-300">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sourceSnippets.length > 0 && (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                        <BookOpen className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      </div>
                      <h3 className="text-sm font-semibold">Direct Snippets From Your File</h3>
                    </div>
                    <ul className="space-y-3">
                      {snippetTargets.map(({ snippet, paragraphIndex }, i) => (
                        <li
                          key={i}
                          className="rounded-xl border border-slate-200/80 bg-white/75 dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <button
                            type="button"
                            onClick={() => handleSnippetJump(paragraphIndex)}
                            className="w-full px-3 py-2.5 text-left text-[13px] italic leading-relaxed text-slate-700 transition hover:bg-slate-100/70 disabled:cursor-default disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-900/60"
                            disabled={paragraphIndex < 0}
                            title={paragraphIndex >= 0 ? "Jump to matching source paragraph" : "No exact paragraph match found"}
                          >
                            &ldquo;{snippet}&rdquo;
                          </button>
                        </li>
                      ))}
                    </ul>
                    {sourceParagraphs.length > 0 && (
                      <details className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Source text ({sourceParagraphs.length} paragraphs)
                        </summary>
                        <ul className="mt-2 space-y-2.5">
                          {sourceParagraphs.map((paragraph, i) => (
                            <li
                              key={`src_paragraph_${i}`}
                              ref={(el) => { sourceParagraphRefs.current[i] = el; }}
                              className={`rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed transition ${
                                activeSourceParagraphIndex === i
                                  ? "border-primary/60 bg-primary/10 text-foreground"
                                  : "border-slate-200/80 bg-white/70 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
                              }`}
                            >
                              {paragraph}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted mb-4">
                  <Lightbulb className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">AI Study Notes</p>
                <p className="mt-1.5 mb-5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  Concise notes with key points and memory aids generated from your material.
                </p>
                {summaryError && (
                  <p className="mb-3 max-w-xs text-xs text-destructive">{summaryError}</p>
                )}
                {textError && (
                  <p className="mb-3 max-w-xs text-xs text-destructive">{textError}</p>
                )}
                <Button
                  onClick={generateSummary}
                  disabled={summaryLoading || !sectionText}
                  className="rounded-full px-5"
                  size="sm"
                >
                  <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                  Generate Notes
                </Button>
                {!sectionText && !textLoading && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Section text must be loaded first.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── Ask AI Tab ─── */}
          <TabsContent value="ask" className="mt-0">
            <div className="space-y-4">
              {/* Chat messages */}
              {chatMessages.length > 0 ? (
                <div className="space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl p-4 text-[13px] sm:text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "ml-8 border bg-primary/5 text-foreground"
                          : "mr-4 border border-blue-200/60 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20"
                      }`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {msg.role === "user" ? "You" : "AI Tutor"}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="mr-4 rounded-2xl border border-blue-200/60 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Tutor</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-100/80 dark:bg-blue-950/40 mb-4">
                    <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium">Ask about this section</p>
                  <p className="mt-1.5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                    Ask any question about {section?.title || "this topic"} and get an explanation from the AI tutor.
                  </p>
                </div>
              )}

              {/* Input */}
              <div className="sticky bottom-0 rounded-2xl border bg-card p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAskAI(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question about this section..."
                    maxLength={500}
                    disabled={chatLoading}
                    className="flex-1 rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/35 disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!chatInput.trim() || chatLoading}
                    className="h-10 w-10 shrink-0 rounded-xl p-0"
                  >
                    {chatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
