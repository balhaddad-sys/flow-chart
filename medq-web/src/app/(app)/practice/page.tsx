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
import { SectionLoadingState } from "@/components/ui/loading-state";
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
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 text-[10px]">Ready</Badge>;
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
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-4 transition-all duration-200 hover:border-primary/15 hover:bg-accent/30">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{section.title}</p>
          {statusBadge(section)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {section.estMinutes}m study time · Difficulty {section.difficulty}/5
        </p>
        {section.questionsErrorMessage && section.questionsStatus === "FAILED" && (
          <p className="mt-2 text-xs text-destructive">{section.questionsErrorMessage}</p>
        )}
        {section.questionsCount > 0 && section.questionsStatus !== "GENERATING" && (
          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
            {section.questionsCount} questions available
          </p>
        )}
        {section.questionsStatus === "GENERATING" && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {section.questionsCount > 0
              ? `${section.questionsCount} ready — generating more...`
              : "Generating questions..."}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        {canStartQuiz ? (
          <Link href={`/practice/quiz?section=${section.id}`}>
            <Button size="sm" className="rounded-xl">
              <CircleHelp className="mr-2 h-4 w-4" />
              Start Quiz
            </Button>
          </Link>
        ) : canGenerate ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => onGenerate(section.id)}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : section.questionsStatus === "FAILED" ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {section.questionsStatus === "FAILED" ? "Retry" : "Generate"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled className="rounded-xl">
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
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    href: "/practice/quiz?mode=random",
    icon: Shuffle,
    label: "Random Quiz",
    description: "Random selection from all available questions",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    href: "/practice/assessment",
    icon: BrainCircuit,
    label: "Assessment",
    description: "Adaptive diagnostics with level-based scoring",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
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
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Select a course first to manage and practice questions.
            </p>
            <Link href="/onboarding">
              <Button size="sm" className="rounded-xl">Create Course</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title animate-in-up stagger-1">Practice</h1>
        <p className="page-subtitle animate-in-up stagger-2">
          {activeCourse ? `Quiz yourself on ${activeCourse.title}` : "Select sections and start quizzing"}
        </p>
      </div>

      {/* Mode cards */}
      {!loading && categorized.ready.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 animate-in-up stagger-3">
          {modeCards.map((mode) => (
            <Link key={mode.href} href={mode.href}>
              <div className={cn(
                "surface-interactive rounded-2xl border border-border/70 bg-card/85 p-4 text-center"
              )}>
                <div className={cn("mx-auto flex h-10 w-10 items-center justify-center rounded-xl", mode.bg)}>
                  <mode.icon className={cn("h-5 w-5", mode.color)} />
                </div>
                <p className="mt-3 text-sm font-semibold">{mode.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <SectionLoadingState
          title="Loading practice sections"
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
        <Tabs defaultValue="ready" className="glass-card p-4 sm:p-5">
          <TabsList className="w-full justify-start rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="ready" className="rounded-lg">Ready to Quiz ({categorized.ready.length})</TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg">All Sections ({sections.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ready" className="space-y-3 mt-4">
            {categorized.ready.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No sections are ready to quiz yet. Generate questions from the All Sections tab.
              </p>
            ) : (
              categorized.ready.map((section, i) => (
                <div key={section.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-in-up">
                  <SectionQuestionCard
                    section={section}
                    generating={!!generatingIds[section.id]}
                    onGenerate={handleGenerate}
                  />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-3 mt-4">
            {sections.map((section, i) => (
              <div key={section.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-in-up">
                <SectionQuestionCard
                  section={section}
                  generating={!!generatingIds[section.id]}
                  onGenerate={handleGenerate}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
