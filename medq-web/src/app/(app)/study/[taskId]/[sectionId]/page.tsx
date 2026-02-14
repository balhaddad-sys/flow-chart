"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Card, CardContent } from "@/components/ui/card";
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

/** Detect if a line looks like a heading (all-caps, short, no trailing punctuation). */
function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  // All-caps line (at least 3 chars) → heading
  if (t.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  // Short line without ending punctuation and contains a capital letter
  if (t.length < 80 && !/[.!?:,;]$/.test(t) && /^[A-Z]/.test(t) && !t.includes("□")) return true;
  return false;
}

/** Split raw text into structured paragraphs with heading detection. */
function parseTextBlocks(text: string) {
  const blocks: { type: "heading" | "paragraph"; content: string }[] = [];
  // Split on double newlines, or single newlines between short lines
  const raw = text.split(/\n\n+/);

  for (const chunk of raw) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Check if the whole chunk is a heading
    if (isHeadingLine(trimmed) && !trimmed.includes("\n")) {
      blocks.push({ type: "heading", content: trimmed });
      continue;
    }

    // Check for embedded headings (line before paragraph)
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

  // Load section data
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid, "sections", sectionId), (snap) => {
      if (snap.exists()) {
        setSection({ ...snap.data(), id: snap.id } as SectionModel);
      }
    });
    return unsub;
  }, [uid, sectionId]);

  // Fetch section text blob
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
          const message = error instanceof Error ? error.message : "Failed to load section text.";
          setSectionText(null);
          setTextError(message);
        }
      } finally {
        if (!cancelled) setTextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section?.textBlobPath]);

  // Auto-start timer
  useEffect(() => {
    start();
    return () => { pause(); reset(); };
  }, [start, pause, reset]);

  // Parse text blocks for Notes tab
  const textBlocks = useMemo(() => {
    if (!sectionText) return [];
    return parseTextBlocks(sectionText);
  }, [sectionText]);

  // Generate AI summary on demand
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
      } catch {
        // Fall through to local API route
      }

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
    <div className="flex min-h-[100dvh] flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {/* Row 1: Back + title + timer */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold tracking-tight truncate">
                {section?.title ?? "Loading..."}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link href="/planner" className="hover:text-foreground">Plan</Link>
                <span>/</span>
                <span className="truncate">Study Session</span>
              </div>
            </div>

            {/* Timer + controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs tabular-nums font-medium">{formatted}</span>
              </div>
              {isRunning ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={pause}>
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={start}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleComplete}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Done
              </Button>
            </div>
          </div>

          {/* Row 2: Topic tags */}
          {section?.topicTags && section.topicTags.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
              {section.estMinutes && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  ~{section.estMinutes} min
                </Badge>
              )}
              {section.topicTags.slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] shrink-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid h-9 w-full grid-cols-3">
            <TabsTrigger value="guide" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="h-3.5 w-3.5" />
              Guide
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
              <Lightbulb className="h-3.5 w-3.5" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Tab: Study Guide — blueprint */}
          <TabsContent value="guide">
            {hasGuide ? (
              <div className="space-y-4">
                {/* Learning Objectives */}
                {bp.learningObjectives?.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <h3 className="text-sm font-semibold">Learning Objectives</h3>
                    </div>
                    <ul className="space-y-1.5 pl-6">
                      {bp.learningObjectives.map((obj, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed">
                          <span className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Key Concepts */}
                {bp.keyConcepts?.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Key Concepts</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {bp.keyConcepts.map((concept, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* High-Yield Points */}
                {bp.highYieldPoints?.length > 0 && (
                  <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <h3 className="text-sm font-semibold">High-Yield Points</h3>
                      </div>
                      <ul className="space-y-1.5">
                        {bp.highYieldPoints.map((point, i) => (
                          <li key={i} className="flex gap-2 text-sm leading-relaxed">
                            <span className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-green-500" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Common Traps */}
                {bp.commonTraps?.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <h3 className="text-sm font-semibold">Common Traps</h3>
                      </div>
                      <ul className="space-y-1.5">
                        {bp.commonTraps.map((trap, i) => (
                          <li key={i} className="flex gap-2 text-sm leading-relaxed">
                            <span className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-orange-500" />
                            <span>{trap}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Terms to Define */}
                {bp.termsToDefine?.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Terms to Know</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {bp.termsToDefine.map((term, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No study guide available</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This section hasn&apos;t been analyzed yet. Try the Notes tab.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Notes — full section text */}
          <TabsContent value="notes">
            {textLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-6 w-1/2 mt-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            ) : sectionText ? (
              <article className="max-w-none">
                {textBlocks.map((block, i) => {
                  if (block.type === "heading") {
                    return (
                      <h3
                        key={i}
                        className="mt-8 mb-3 text-base font-semibold tracking-tight text-foreground first:mt-0"
                      >
                        {block.content}
                      </h3>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className="mb-4 text-[14px] leading-[1.75] text-foreground/85"
                    >
                      {block.content}
                    </p>
                  );
                })}
              </article>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No text content available</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {textError ?? "The extracted text for this section could not be loaded."}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab: AI Summary — generated on demand */}
          <TabsContent value="summary">
            {summary ? (
              <div className="space-y-4">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Overview</h3>
                  <p className="text-sm leading-relaxed text-foreground/85">
                    {summary.summary}
                  </p>
                </section>

                {summary.keyPoints?.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Key Points</h3>
                    <ul className="space-y-1.5">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed">
                          <span className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {summary.mnemonics?.length > 0 && (
                  <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-violet-500" />
                        <h3 className="text-sm font-semibold">Memory Aids</h3>
                      </div>
                      <ul className="space-y-1.5">
                        {summary.mnemonics.map((m, i) => (
                          <li key={i} className="text-sm leading-relaxed text-violet-700 dark:text-violet-300">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lightbulb className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">AI-Powered Summary</p>
                <p className="mt-1 mb-4 text-xs text-muted-foreground">
                  Generate a concise summary with key points and mnemonics.
                </p>
                {summaryError && (
                  <p className="mb-3 max-w-md text-xs text-destructive">{summaryError}</p>
                )}
                <Button
                  onClick={generateSummary}
                  disabled={summaryLoading || !sectionText}
                  size="sm"
                >
                  {summaryLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="mr-1.5 h-4 w-4" />
                      Generate Summary
                    </>
                  )}
                </Button>
                {!sectionText && !textLoading && (
                  <p className="mt-2 text-xs text-muted-foreground">
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
