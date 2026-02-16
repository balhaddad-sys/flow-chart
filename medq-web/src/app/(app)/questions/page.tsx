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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    return <Badge variant="outline">Analyzing</Badge>;
  }
  if (section.questionsStatus === "GENERATING") {
    const label = section.questionsCount > 0 ? "Ready + Generating" : "Generating";
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {label}
      </Badge>
    );
  }
  if (section.questionsCount > 0) {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">Ready</Badge>;
  }
  if (section.questionsStatus === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return <Badge variant="outline">Needs Questions</Badge>;
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
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{section.title}</p>
            {statusBadge(section)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {section.estMinutes}m study time - Difficulty {section.difficulty}/5
          </p>
          {section.questionsErrorMessage && section.questionsStatus === "FAILED" && (
            <p className="mt-2 text-xs text-destructive">{section.questionsErrorMessage}</p>
          )}
          {section.questionsCount > 0 && section.questionsStatus !== "GENERATING" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {section.questionsCount} questions available
            </p>
          )}
          {section.questionsStatus === "GENERATING" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {section.questionsCount > 0
                ? `${section.questionsCount} ready — generating more…`
                : "Generating questions…"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {canStartQuiz ? (
            <Link href={`/quiz?section=${section.id}`}>
              <Button size="sm">
                <CircleHelp className="mr-2 h-4 w-4" />
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : section.questionsStatus === "FAILED" ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {section.questionsStatus === "FAILED" ? "Retry" : "Generate"}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled>
              {section.aiStatus !== "ANALYZED" ? "Waiting Analysis" : "In Progress"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuestionsPage() {
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
              <Button size="sm">Create Course</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title">Practice</h1>
        <p className="page-subtitle">
          {activeCourse ? `Quiz yourself on ${activeCourse.title}` : "Select sections and start quizzing"}
        </p>
      </div>

      {!loading && categorized.ready.length > 0 && (
        <div className="glass-card flex flex-wrap gap-2 p-4">
          <Link href="/quiz?mode=mixed">
            <Button variant="outline" size="sm">
              <Zap className="mr-2 h-4 w-4 text-amber-500" />
              Smart Mix
            </Button>
          </Link>
          <Link href="/quiz?mode=random">
            <Button variant="outline" size="sm">
              <Shuffle className="mr-2 h-4 w-4 text-blue-500" />
              Random Quiz
            </Button>
          </Link>
          <Link href="/assessment">
            <Button variant="outline" size="sm">
              <BrainCircuit className="mr-2 h-4 w-4 text-emerald-500" />
              Adaptive Assessment
            </Button>
          </Link>
        </div>
      )}

      {loading ? (
        <div className="glass-card space-y-3 p-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-16 w-full rounded-lg" />
          ))}
        </div>
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
            <TabsTrigger value="ready">Ready to Quiz ({categorized.ready.length})</TabsTrigger>
            <TabsTrigger value="all">All Sections ({sections.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ready" className="space-y-3">
            {categorized.ready.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No sections are ready to quiz yet. Generate questions from the All Sections tab.
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

          <TabsContent value="all" className="space-y-3">
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
      )}
    </div>
  );
}
