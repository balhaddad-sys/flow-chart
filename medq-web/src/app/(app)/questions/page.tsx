"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CircleHelp,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
  if (section.questionsStatus === "COMPLETED" && section.questionsCount > 0) return "ready";
  if (section.aiStatus === "PENDING" || section.aiStatus === "PROCESSING" || section.questionsStatus === "GENERATING") {
    return "processing";
  }
  return "needs";
}

function statusBadge(section: SectionModel) {
  if (section.aiStatus !== "ANALYZED") {
    return <Badge variant="outline">Analyzing</Badge>;
  }
  if (section.questionsStatus === "COMPLETED" && section.questionsCount > 0) {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">Ready</Badge>;
  }
  if (section.questionsStatus === "GENERATING") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generating
      </Badge>
    );
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
  const canStartQuiz = section.questionsStatus === "COMPLETED" && section.questionsCount > 0;
  const canGenerate =
    section.aiStatus === "ANALYZED" &&
    (section.questionsStatus === "FAILED" ||
      section.questionsStatus === "PENDING" ||
      section.questionsCount === 0);

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="rounded-md bg-muted p-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{section.title}</p>
            {statusBadge(section)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {section.estMinutes}m study time | Difficulty {section.difficulty}/5
          </p>
          {section.questionsErrorMessage && section.questionsStatus === "FAILED" && (
            <p className="mt-2 text-xs text-destructive">{section.questionsErrorMessage}</p>
          )}
          {section.questionsCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {section.questionsCount} questions available
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
      toast.success(`Generated ${result.questionCount ?? 0} questions.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate questions.";
      toast.error(message);
    } finally {
      setGeneratingIds((prev) => ({ ...prev, [sectionId]: false }));
    }
  }

  if (!courseId) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
        <h1 className="text-2xl font-bold">Questions</h1>
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
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCourse ? `Manage question sets for ${activeCourse.title}` : "Manage section question sets"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{categorized.ready.length} ready</Badge>
          <Badge variant="outline">{categorized.needs.length} need generation</Badge>
          <Badge variant="outline">{categorized.processing.length} processing</Badge>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No sections found yet. Upload materials in the library first.
            </p>
            <Link href="/library">
              <Button size="sm" variant="outline">
                Go to Library
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">All ({sections.length})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({categorized.ready.length})</TabsTrigger>
            <TabsTrigger value="needs">Needs Work ({categorized.needs.length})</TabsTrigger>
            <TabsTrigger value="processing">Processing ({categorized.processing.length})</TabsTrigger>
          </TabsList>

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

          <TabsContent value="ready" className="space-y-3">
            {categorized.ready.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No ready question sets yet.
                </CardContent>
              </Card>
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

          <TabsContent value="needs" className="space-y-3">
            {categorized.needs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No sections need action right now.
                </CardContent>
              </Card>
            ) : (
              categorized.needs.map((section) => (
                <SectionQuestionCard
                  key={section.id}
                  section={section}
                  generating={!!generatingIds[section.id]}
                  onGenerate={handleGenerate}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-3">
            {categorized.processing.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nothing is processing right now.
                </CardContent>
              </Card>
            ) : (
              categorized.processing.map((section) => (
                <SectionQuestionCard
                  key={section.id}
                  section={section}
                  generating={!!generatingIds[section.id]}
                  onGenerate={handleGenerate}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
