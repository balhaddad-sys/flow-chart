"use client";

import { use, useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTimerStore } from "@/lib/stores/timer-store";
import { updateTask } from "@/lib/firebase/firestore";
import { getFileDownloadUrl } from "@/lib/firebase/storage";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { toast } from "sonner";
import type { SectionModel } from "@/lib/types/section";

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
  const { uid } = useAuth();
  const { seconds, isRunning, start, pause, reset, getFormatted } = useTimerStore();
  const [section, setSection] = useState<SectionModel | null>(null);
  const [sectionText, setSectionText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

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

  // Fetch section text blob from Cloud Storage
  useEffect(() => {
    if (!section?.textBlobPath) return;
    let cancelled = false;
    setTextLoading(true);
    (async () => {
      try {
        const url = await getFileDownloadUrl(section.textBlobPath);
        const res = await fetch(url);
        const text = await res.text();
        if (!cancelled) setSectionText(text);
      } catch {
        if (!cancelled) setSectionText(null);
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

  // Generate AI summary on demand
  const generateSummary = useCallback(async () => {
    if (!sectionText || !section?.title || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionText: sectionText.slice(0, 8000), title: section.title }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
      }
    } catch {
      toast.error("Failed to generate summary.");
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 p-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {section?.title ?? "Loading..."}
            </h1>
            {section?.estMinutes && (
              <p className="text-xs text-muted-foreground">
                ~{section.estMinutes} min read
              </p>
            )}
          </div>
          {/* Timer */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums font-medium">{formatted}</span>
            {isRunning ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={pause}>
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={start}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={handleComplete}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Tabs defaultValue="notes" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="notes" className="flex-1 gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex-1 gap-1.5">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Study Guide</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 gap-1.5">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">AI Summary</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Notes — full section text */}
          <TabsContent value="notes">
            {textLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            ) : sectionText ? (
              <article className="prose prose-sm dark:prose-invert max-w-none">
                {sectionText.split("\n\n").map((paragraph, i) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return null;
                  // Detect heading-like lines (short, no period at end)
                  if (trimmed.length < 80 && !trimmed.endsWith(".") && trimmed === trimmed.replace(/[.!?]$/, "")) {
                    return <h3 key={i} className="mt-6 mb-2 text-base font-semibold">{trimmed}</h3>;
                  }
                  return (
                    <p key={i} className="mb-3 leading-relaxed text-sm text-foreground/90">
                      {trimmed}
                    </p>
                  );
                })}
              </article>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">No text content available</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The extracted text for this section could not be loaded.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Study Guide — blueprint */}
          <TabsContent value="guide">
            {bp ? (
              <div className="space-y-5">
                {/* Learning Objectives */}
                {bp.learningObjectives?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        <h3 className="text-sm font-semibold">Learning Objectives</h3>
                      </div>
                      <ul className="space-y-2">
                        {bp.learningObjectives.map((obj, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                            <span className="text-muted-foreground">{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Key Concepts */}
                {bp.keyConcepts?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="mb-3 text-sm font-semibold">Key Concepts</h3>
                      <div className="flex flex-wrap gap-2">
                        {bp.keyConcepts.map((concept, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* High-Yield Points */}
                {bp.highYieldPoints?.length > 0 && (
                  <Card className="border-green-200 dark:border-green-900">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-green-500" />
                        <h3 className="text-sm font-semibold">High-Yield Points</h3>
                      </div>
                      <ul className="space-y-2">
                        {bp.highYieldPoints.map((point, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Common Traps */}
                {bp.commonTraps?.length > 0 && (
                  <Card className="border-orange-200 dark:border-orange-900">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <h3 className="text-sm font-semibold">Common Traps</h3>
                      </div>
                      <ul className="space-y-2">
                        {bp.commonTraps.map((trap, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-orange-500" />
                            <span className="text-orange-700 dark:text-orange-300">{trap}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Terms to Define */}
                {bp.termsToDefine?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="mb-3 text-sm font-semibold">Terms to Know</h3>
                      <div className="flex flex-wrap gap-2">
                        {bp.termsToDefine.map((term, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {term}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">No study guide available</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This section hasn&apos;t been analyzed yet.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab: AI Summary — generated on demand */}
          <TabsContent value="summary">
            {summary ? (
              <div className="space-y-5">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-2 text-sm font-semibold">Overview</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {summary.summary}
                    </p>
                  </CardContent>
                </Card>

                {summary.keyPoints?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="mb-3 text-sm font-semibold">Key Points</h3>
                      <ul className="space-y-2">
                        {summary.keyPoints.map((point, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-muted-foreground">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {summary.mnemonics?.length > 0 && (
                  <Card className="border-violet-200 dark:border-violet-900">
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-violet-500" />
                        <h3 className="text-sm font-semibold">Memory Aids</h3>
                      </div>
                      <ul className="space-y-2">
                        {summary.mnemonics.map((m, i) => (
                          <li key={i} className="text-sm text-violet-700 dark:text-violet-300">
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
                <Lightbulb className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">AI-Powered Summary</p>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  Generate a concise summary with key points and mnemonics.
                </p>
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
