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
  Clock,
  BrainCircuit,
  Sparkles,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InlineLoadingState,
  SectionLoadingState,
} from "@/components/ui/loading-state";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTimerStore } from "@/lib/stores/timer-store";
import { updateTask } from "@/lib/firebase/firestore";
import { getTextBlob } from "@/lib/firebase/storage";
import * as fn from "@/lib/firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";
import { StudyAskAiWidget } from "@/components/study/study-ask-ai-widget";
import {
  cleanOCR,
  parseTextBlocks,
  buildNoteSections,
  deriveSourceSnippets,
  deriveSourceParagraphs,
  findBestParagraphIndex,
  deriveFallbackGuide,
} from "@/lib/utils/study-text";
import type { SectionModel } from "@/lib/types/section";
import type { TaskModel } from "@/lib/types/task";

type KnowledgeStage = "STUDY" | "QUESTIONS" | "REVIEW";

const STAGE_META: Record<KnowledgeStage, {
  label: string;
  description: string;
  icon: typeof BookOpen;
  color: string;
  bg: string;
}> = {
  STUDY: {
    label: "Learn",
    description: "Build understanding — focus on objectives and key concepts.",
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/60",
  },
  QUESTIONS: {
    label: "Test",
    description: "Challenge your recall — focus on high-yield facts and common traps.",
    icon: HelpCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
  },
  REVIEW: {
    label: "Review",
    description: "Consolidate knowledge — synthesize and practice recall.",
    icon: RotateCcw,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-950/60",
  },
};

interface AISummary {
  summary: string;
  keyPoints: string[];
  mnemonics: string[];
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
  const [task, setTask] = useState<TaskModel | null>(null);
  const [section, setSection] = useState<SectionModel | null>(null);
  const [sectionText, setSectionText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activeSourceParagraphIndex, setActiveSourceParagraphIndex] = useState<number | null>(null);
  const sourceParagraphRefs = useRef<Record<number, HTMLLIElement | null>>({});


  // Fetch task to determine knowledge stage
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid, "tasks", taskId), (snap) => {
      if (snap.exists()) {
        setTask({ ...snap.data(), id: snap.id } as TaskModel);
      }
    });
    return unsub;
  }, [uid, taskId]);

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
    return () => {
      pause();
      reset();
      summaryAbortRef.current?.abort();
    };
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

  const summaryAbortRef = useRef<AbortController | null>(null);

  const generateSummary = useCallback(async () => {
    if (!sectionText || !section?.title || summaryLoading) return;
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const input = { sectionText: sectionText.slice(0, 8000), title: section.title };
      try {
        const data = await fn.generateSectionSummary(input);
        if (controller.signal.aborted) return;
        if (data?.summary || data?.keyPoints?.length || data?.mnemonics?.length) {
          setSummary(data);
          return;
        }
      } catch { /* fall through */ }

      if (controller.signal.aborted) return;
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "Failed to generate summary.");
      }
      setSummary(json.data as AISummary);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Failed to generate summary.";
      setSummaryError(message);
    } finally {
      if (!controller.signal.aborted) setSummaryLoading(false);
    }
  }, [sectionText, section?.title, summaryLoading, user]);

  // Auto-generate notes when section text loads
  useEffect(() => {
    if (sectionText && section?.title && !summary && !summaryLoading && !summaryError) {
      generateSummary();
    }
  }, [sectionText, section?.title]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const stage: KnowledgeStage = (task?.type as KnowledgeStage) ?? "STUDY";
  const rawBp = section?.blueprint;
  const bp = useMemo(() => {
    if (!rawBp) return null;
    const objectives = rawBp.learningObjectives?.map(cleanOCR) ?? [];
    const highYield = rawBp.highYieldPoints?.map(cleanOCR) ?? [];
    // Deduplicate: remove high-yield items that duplicate learning objectives
    const objKeys = new Set(objectives.map((s) => s.toLowerCase()));
    const uniqueHighYield = highYield.filter((s) => !objKeys.has(s.toLowerCase()));
    return {
      learningObjectives: objectives,
      keyConcepts: rawBp.keyConcepts?.map(cleanOCR) ?? [],
      highYieldPoints: uniqueHighYield,
      commonTraps: rawBp.commonTraps?.map(cleanOCR) ?? [],
      termsToDefine: rawBp.termsToDefine?.map(cleanOCR) ?? [],
    };
  }, [rawBp]);
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
  const stageMeta = STAGE_META[stage];
  const StageIcon = stageMeta.icon;

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
              {section?.title ?? "Loading section..."}
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
            <Badge
              variant="secondary"
              className={`text-[10px] shrink-0 rounded-full border-transparent ${stageMeta.bg} ${stageMeta.color}`}
            >
              <StageIcon className="mr-1 h-3 w-3" />
              {stageMeta.label}
            </Badge>
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
          <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl p-1">
            <TabsTrigger value="guide" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <Lightbulb className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* ─── Guide Tab ─── */}
          <TabsContent value="guide" className="space-y-4 mt-0">
            {/* Stage banner */}
            {(() => {
              const meta = STAGE_META[stage];
              const StageIcon = meta.icon;
              return (
                <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 sm:p-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                    <StageIcon className={`h-4.5 w-4.5 ${meta.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}</p>
                    <p className="text-[13px] leading-snug text-foreground/70">{meta.description}</p>
                  </div>
                </div>
              );
            })()}

            {hasBlueprintGuide ? (
              <>
                {/* ── STUDY: Objectives → Concepts → Terms → High-Yield → Synthesis ── */}
                {stage === "STUDY" && (
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
                            <span key={i} className="inline-flex rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium">{concept}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {bp.termsToDefine?.length > 0 && (
                      <div className="rounded-2xl border bg-card p-4 sm:p-5">
                        <h3 className="text-sm font-semibold mb-3">Terms to Know</h3>
                        <div className="flex flex-wrap gap-2">
                          {bp.termsToDefine.map((term, i) => (
                            <span key={i} className="inline-flex rounded-full border px-3 py-1.5 text-xs font-medium">{term}</span>
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
                  </>
                )}

                {/* ── QUESTIONS: High-Yield → Traps → Concepts → Drills ── */}
                {stage === "QUESTIONS" && (
                  <>
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
                    {bp.keyConcepts?.length > 0 && (
                      <div className="rounded-2xl border bg-card p-4 sm:p-5">
                        <h3 className="text-sm font-semibold mb-3">Key Concepts</h3>
                        <div className="flex flex-wrap gap-2">
                          {bp.keyConcepts.map((concept, i) => (
                            <span key={i} className="inline-flex rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium">{concept}</span>
                          ))}
                        </div>
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
                            <li key={`angle_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">{item}</li>
                          ))}
                          {fallbackGuide.recallPrompts.slice(0, 3).map((prompt, i) => (
                            <li key={`prompt_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">{prompt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* ── REVIEW: Synthesis → Recall → Quick-Refresh → Traps → Memory Aids ── */}
                {stage === "REVIEW" && (
                  <>
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
                    {(fallbackGuide.recallPrompts.length > 0 || fallbackGuide.examAngles.length > 0) && (
                      <div className="rounded-2xl border border-violet-200/80 bg-violet-50/45 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                        <div className="mb-3 flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <h3 className="text-sm font-semibold">Recall Practice</h3>
                        </div>
                        <ul className="space-y-2.5">
                          {fallbackGuide.recallPrompts.slice(0, 3).map((prompt, i) => (
                            <li key={`prompt_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">{prompt}</li>
                          ))}
                          {fallbackGuide.examAngles.slice(0, 3).map((item, i) => (
                            <li key={`angle_${i}`} className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2 text-[13px] sm:text-sm text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {bp.highYieldPoints?.length > 0 && (
                      <div className="rounded-2xl border border-green-200/80 bg-green-50/50 p-4 sm:p-5 dark:border-green-900/50 dark:bg-green-950/20">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-green-100 dark:bg-green-900/40">
                            <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <h3 className="text-sm font-semibold">Quick Refresh</h3>
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
                          <h3 className="text-sm font-semibold">Watch Out For</h3>
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
                    {(summary?.mnemonics?.length ?? 0) > 0 && (
                      <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-900/40">
                            <BrainCircuit className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <h3 className="text-sm font-semibold">Memory Aids</h3>
                        </div>
                        <ul className="space-y-2">
                          {summary!.mnemonics!.map((m, i) => (
                            <li key={i} className="text-[13px] sm:text-sm leading-relaxed text-violet-700 dark:text-violet-300">{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : hasFallbackGuide ? (
              <div className="space-y-4">
                {/* STUDY: objectives + highYield */}
                {stage === "STUDY" && fallbackGuide.objectives.length > 0 && (
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
                      <h3 className="text-sm font-semibold">{stage === "REVIEW" ? "Quick Refresh" : "High-Yield Highlights"}</h3>
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

                {stage !== "STUDY" && fallbackGuide.examAngles.length > 0 && (
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/45 p-4 sm:p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                        <BrainCircuit className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-sm font-semibold">{stage === "REVIEW" ? "Recall Practice" : "Exam Angles"}</h3>
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
              <SectionLoadingState
                title="Generating study notes"
                description="Building a concise clinical summary from your section."
                rows={3}
                className="rounded-2xl"
              />
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
                {textLoading && (
                  <InlineLoadingState
                    label="Loading section text..."
                    className="mt-3 text-[11px]"
                  />
                )}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Floating AI chat widget */}
      <StudyAskAiWidget
        sectionTitle={section?.title}
        courseId={section?.courseId}
      />
    </div>
  );
}
