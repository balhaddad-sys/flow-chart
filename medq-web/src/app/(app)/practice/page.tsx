"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CircleHelp,
  Loader2,
  RefreshCw,
  Sparkles,
  Shuffle,
  Zap,
  BrainCircuit,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { useSections } from "@/lib/hooks/useSections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  InlineLoadingState,
  LoadingButtonLabel,
  SectionLoadingState,
} from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import * as fn from "@/lib/firebase/functions";
import type { SectionModel } from "@/lib/types/section";
import { toast } from "sonner";

type QuestionBucket = "ready" | "needs" | "processing";

function getQuestionBucket(section: SectionModel): QuestionBucket {
  if (section.questionsCount > 0) return "ready";
  if (section.aiStatus === "PENDING" || section.aiStatus === "PROCESSING" || section.questionsStatus === "GENERATING") {
    return "processing";
  }
  return "needs";
}

function statusBadge(section: SectionModel) {
  if (section.aiStatus !== "ANALYZED") {
    return <Badge variant="outline" className="text-[10px]">Analyzing</Badge>;
  }
  if (section.questionsStatus === "GENERATING") {
    const label = section.questionsCount > 0 ? "Ready + Generating" : "Generating";
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        {label}
      </Badge>
    );
  }
  if (section.questionsCount > 0) {
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 hover:bg-emerald-100 text-[10px]">Ready</Badge>;
  }
  if (section.questionsStatus === "FAILED") {
    return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">Needs Questions</Badge>;
}

function SectionQuestionCard({
  section,
  generating,
  onGenerate,
}: {
  section: SectionModel;
  generating: boolean;
  onGenerate: (sectionId: string) => Promise<void>;
}) {
  const canStartQuiz = section.questionsCount > 0;
  const canGenerate =
    section.aiStatus === "ANALYZED" &&
    section.questionsStatus !== "GENERATING" &&
    (section.questionsStatus === "FAILED" ||
      section.questionsStatus === "PENDING" ||
      section.questionsCount === 0);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3.5 transition-all hover:bg-accent/40 hover:border-primary/20">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{section.title}</p>
          {statusBadge(section)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {section.estMinutes}m study time · Difficulty {section.difficulty}/5
        </p>
        {section.questionsErrorMessage && section.questionsStatus === "FAILED" && (
          <p className="mt-2 text-xs text-destructive">{section.questionsErrorMessage}</p>
        )}
        {section.questionsCount > 0 && section.questionsStatus !== "GENERATING" && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {section.questionsCount} questions available
          </p>
        )}
        {section.questionsStatus === "GENERATING" && (
          <div className="mt-1.5">
            <InlineLoadingState
              className="text-xs"
              label={
                section.questionsCount > 0
                  ? `${section.questionsCount} ready — generating more...`
                  : "Generating questions..."
              }
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        {canStartQuiz ? (
          <Link href={`/practice/quiz?section=${section.id}`}>
            <Button size="sm">
              <CircleHelp className="mr-1.5 h-3.5 w-3.5" />
              Start Quiz
            </Button>
          </Link>
        ) : canGenerate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGenerate(section.id)}
            disabled={generating}
          >
            {generating ? (
              <LoadingButtonLabel
                label={section.questionsStatus === "FAILED" ? "Retrying..." : "Generating..."}
              />
            ) : section.questionsStatus === "FAILED" ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled>
            {section.aiStatus !== "ANALYZED" ? "Waiting Analysis" : "In Progress"}
          </Button>
        )}
      </div>
    </div>
  );
}

const modeCards = [
  {
    href: "/practice/quiz?mode=mixed",
    icon: Zap,
    label: "Smart Mix",
    description: "AI-weighted mix focusing on weak areas",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    href: "/practice/quiz?mode=random",
    icon: Shuffle,
    label: "Random Quiz",
    description: "Random selection from all questions",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    href: "/practice/assessment",
    icon: BrainCircuit,
    label: "Assessment",
    description: "Adaptive diagnostics with scoring",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-500/10",
  },
];

export default function PracticePage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { courses } = useCourses();
  const { sections, loading } = useSections(courseId);
  const [generatingIds, setGeneratingIds] = useState<Record<string, boolean>>({});

  const activeCourse = courses.find((course) => course.id === courseId);

  const categorized = useMemo(() => {
    const ready: SectionModel[] = [];
    const needs: SectionModel[] = [];
    const processing: SectionModel[] = [];

    for (const section of sections) {
      const bucket = getQuestionBucket(section);
      if (bucket === "ready") ready.push(section);
      if (bucket === "needs") needs.push(section);
      if (bucket === "processing") processing.push(section);
    }

    return { ready, needs, processing };
  }, [sections]);

  async function handleGenerate(sectionId: string) {
    if (!courseId) return;
    setGeneratingIds((prev) => ({ ...prev, [sectionId]: true }));
    try {
      const result = await fn.generateQuestions({ courseId, sectionId, count: 10 });
      if (result.inProgress) {
        toast.info("Question generation already in progress.");
      } else if (result.fromCache) {
        toast.success(`${result.questionCount ?? 0} questions already available.`);
      } else {
        toast.success("Generating questions — they'll appear as they're ready.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate questions.";
      toast.error(message);
    } finally {
      setGeneratingIds((prev) => ({ ...prev, [sectionId]: false }));
    }
  }

  if (!courseId) {
    return (
      <div className="page-wrap page-stack">
        <h1 className="page-title">Practice</h1>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted-foreground">
              Select a course first to manage and practice questions.
            </p>
            <Link href="/onboarding">
              <Button size="sm">Create Course</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack">

      {/* Header */}
      <div className="animate-in-up">
        <h1 className="page-title">Practice</h1>
        <p className="page-subtitle">
          {activeCourse
            ? `Test your knowledge of ${activeCourse.title} with AI-generated questions.`
            : "Select sections and start quizzing."}
        </p>
      </div>

      {/* Mode cards */}
      {!loading && categorized.ready.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-3 animate-in-up stagger-1">
          {modeCards.map((mode) => (
            <Link key={mode.href} href={mode.href}>
              <div className="surface-interactive p-4">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", mode.bg)}>
                  <mode.icon className={cn("h-4.5 w-4.5", mode.color)} />
                </div>
                <p className="mt-2.5 text-[13px] font-semibold">{mode.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{mode.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <SectionLoadingState
          title="Loading sections"
          description="Fetching analyzed sections and quiz readiness."
          rows={4}
        />
      ) : sections.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No sections found"
          description="Upload materials in the Library first."
          action={{ label: "Go to Library", href: "/library" }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 animate-in-up stagger-2">
          <Tabs defaultValue="ready">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="ready">Ready ({categorized.ready.length})</TabsTrigger>
              <TabsTrigger value="all">All ({sections.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="ready" className="space-y-2 mt-4">
              {categorized.ready.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No sections are ready yet. Generate questions from the All tab.
                </p>
              ) : (
                categorized.ready.map((section) => (
                  <SectionQuestionCard
                    key={section.id}
                    section={section}
                    generating={!!generatingIds[section.id]}
                    onGenerate={handleGenerate}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-2 mt-4">
              {sections.map((section) => (
                <SectionQuestionCard
                  key={section.id}
                  section={section}
                  generating={!!generatingIds[section.id]}
                  onGenerate={handleGenerate}
                />
              ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
