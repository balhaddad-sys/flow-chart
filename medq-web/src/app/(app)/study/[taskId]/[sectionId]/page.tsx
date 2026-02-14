"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  BookOpen,
  FileText,
  Target,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Clock,
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
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";
import type { SectionModel } from "@/lib/types/section";

interface AISummary {
  summary: string;
  keyPoints: string[];
  mnemonics: string[];
}

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
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
    if (isHeadingLine(trimmed) && !trimmed.includes("\n")) {
      blocks.push({ type: "heading", content: trimmed });
      continue;
    }
    const lines = trimmed.split("\n");
    if (lines.length >= 2 && isHeadingLine(lines[0]) && lines[0].length < 100) {
      blocks.push({ type: "heading", content: lines[0].trim() });
      blocks.push({ type: "paragraph", content: lines.slice(1).join(" ").trim() });
      continue;
    }
    blocks.push({ type: "paragraph", content: trimmed.replace(/\n/g, " ") });
  }
  return blocks;
}

export default function StudySessionPage({
  params,
}: {
  params: Promise<{ taskId: string; sectionId: string }>;
}) {
  const { taskId, sectionId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const { seconds, isRunning, start, pause, reset, getFormatted } = useTimerStore();
  const [section, setSection] = useState<SectionModel | null>(null);
  const [sectionText, setSectionText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      toast.error(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [sectionText, section?.title, summaryLoading]);

  async function handleComplete() {
    if (!uid) return;
    pause();
    const minutes = Math.ceil(seconds / 60);
    await updateTask(uid, taskId, { status: "DONE", actualMinutes: minutes });
    reset();
    toast.success("Session complete!");
    router.push("/planner");
  }

  const formatted = getFormatted();
  const bp = section?.blueprint;
  const hasGuide = bp && (
    (bp.learningObjectives?.length ?? 0) > 0 ||
    (bp.keyConcepts?.length ?? 0) > 0 ||
    (bp.highYieldPoints?.length ?? 0) > 0
  );
  const defaultTab = hasGuide ? "guide" : "notes";

  return (
    <div className="flex flex-col">
      {/* ── Sticky header ── sits below the CourseSwitcherBar (min-h-12) */}
      <div className="sticky top-12 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
            <div className="flex items-center gap-1.5 rounded-full bg-muted/80 pl-2.5 pr-1 py-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
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
              <FileText className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-lg gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
              <Lightbulb className="h-3.5 w-3.5" />
              AI Summary
            </TabsTrigger>
          </TabsList>

          {/* ─── Guide Tab ─── */}
          <TabsContent value="guide" className="space-y-4 mt-0">
            {hasGuide ? (
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
              </>
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

          {/* ─── Notes Tab ─── */}
          <TabsContent value="notes" className="mt-0">
            {textLoading ? (
              <div className="space-y-5 py-2">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[88%]" />
                <div className="pt-3" />
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            ) : sectionText ? (
              <article className="py-1">
                {textBlocks.map((block, i) => {
                  if (block.type === "heading") {
                    return (
                      <h3
                        key={i}
                        className="mt-10 mb-4 text-base sm:text-lg font-bold tracking-tight text-foreground first:mt-0 leading-snug"
                      >
                        {block.content}
                      </h3>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className="mb-5 text-[15px] sm:text-base leading-[1.85] text-foreground/75"
                    >
                      {block.content}
                    </p>
                  );
                })}
              </article>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No text content available</p>
                <p className="mt-1.5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  {textError ?? "The extracted text for this section could not be loaded."}
                </p>
              </div>
            )}
          </TabsContent>

          {/* ─── Summary Tab ─── */}
          <TabsContent value="summary" className="space-y-4 mt-0">
            {summary ? (
              <>
                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                  <h3 className="text-sm font-semibold mb-2">Overview</h3>
                  <p className="text-[13px] sm:text-sm leading-relaxed text-foreground/80">
                    {summary.summary}
                  </p>
                </div>

                {summary.keyPoints?.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <h3 className="text-sm font-semibold mb-3">Key Points</h3>
                    <ul className="space-y-3">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 text-[13px] sm:text-sm leading-relaxed">
                          <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-primary/60" />
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
                        <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted mb-4">
                  <Lightbulb className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">AI-Powered Summary</p>
                <p className="mt-1.5 mb-5 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  Get a concise summary with key takeaways and memory aids.
                </p>
                {summaryError && (
                  <p className="mb-3 max-w-xs text-xs text-destructive">{summaryError}</p>
                )}
                <Button
                  onClick={generateSummary}
                  disabled={summaryLoading || !sectionText}
                  className="rounded-full px-5"
                  size="sm"
                >
                  {summaryLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                      Generate Summary
                    </>
                  )}
                </Button>
                {!sectionText && !textLoading && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Section text must be loaded first.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
