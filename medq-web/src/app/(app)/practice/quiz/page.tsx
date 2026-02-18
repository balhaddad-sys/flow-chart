"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCourseStore } from "@/lib/stores/course-store";
import { useQuizStore } from "@/lib/stores/quiz-store";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizResults } from "@/components/quiz/quiz-results";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageLoadingState } from "@/components/ui/loading-state";
import { CircleHelp } from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import type { QuizMode } from "@/lib/firebase/functions";
import type { QuestionModel } from "@/lib/types/question";

const MODE_LABELS: Record<QuizMode, string> = {
  section: "Section Quiz",
  topic: "Topic Quiz",
  mixed: "Smart Mix",
  random: "Random",
};

export default function QuizPage() {
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("section");
  const mode = (searchParams.get("mode") as QuizMode) || "section";
  const topicTag = searchParams.get("topic");
  const courseId = useCourseStore((s) => s.activeCourseId);

  const { questions, currentIndex, isFinished, startQuiz, reset } = useQuizStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSection = mode === "section";
  const canLoad = courseId && (needsSection ? sectionId : true);

  useEffect(() => {
    if (!canLoad || questions.length > 0) return;
    let cancelled = false;

    async function loadQuiz() {
      setLoading(true);
      setError(null);
      try {
        const result = await fn.getQuiz({
          courseId: courseId!,
          sectionId: sectionId || undefined,
          topicTag: topicTag || undefined,
          mode,
          count: 10,
        });
        if (cancelled) return;
        const quizQuestions = (result as unknown as { questions?: QuestionModel[] }).questions ?? [];
        if (quizQuestions.length === 0) {
          setError("No questions available yet. Generate questions from the Practice page first.");
        } else {
          startQuiz(quizQuestions);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuiz();
    return () => { cancelled = true; };
  }, [canLoad, courseId, sectionId, topicTag, mode, questions.length, startQuiz]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  if (loading) {
    return (
      <PageLoadingState
        title="Preparing your quiz"
        description="Loading questions and calibrating your practice session."
        className="page-wrap py-16"
      />
    );
  }

  if (error) {
    return (
      <div className="page-wrap mx-auto max-w-md py-24 text-center">
        <div className="glass-card rounded-2xl p-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!courseId || (needsSection && !sectionId)) {
    return (
      <div className="page-wrap mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
        <CircleHelp className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No section selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a section from the Practice page to start quizzing.
        </p>
        <Link href="/practice">
          <Button variant="outline" size="sm" className="mt-4 rounded-xl">
            Go to Practice
          </Button>
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="page-wrap p-4 sm:p-6">
        <QuizResults />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/practice" className="hover:text-foreground transition-colors">Practice</Link>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">Quiz</span>
          {mode !== "section" && (
            <Badge variant="secondary" className="ml-1 text-[10px]">{MODE_LABELS[mode]}</Badge>
          )}
        </div>
        <Progress value={progressPercent} className="h-2.5" />
      </div>

      <div className="divider-fade" />
      <div key={currentQuestion.id} className="animate-in-right">
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          total={questions.length}
        />
      </div>
    </div>
  );
}
