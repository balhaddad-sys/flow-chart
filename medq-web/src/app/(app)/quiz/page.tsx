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
import { Loader2, CircleHelp } from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import type { QuestionModel } from "@/lib/types/question";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("section");
  const courseId = useCourseStore((s) => s.activeCourseId);

  const { questions, currentIndex, isFinished, startQuiz, reset } = useQuizStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !sectionId || questions.length > 0) return;

    async function loadQuiz() {
      setLoading(true);
      setError(null);
      try {
        const result = await fn.getQuiz({
          courseId: courseId!,
          sectionId: sectionId!,
          mode: "section",
          count: 10,
        });
        const quizQuestions = (result as unknown as { questions?: QuestionModel[] }).questions ?? [];
        if (quizQuestions.length === 0) {
          setError("No questions available for this section yet.");
        } else {
          startQuiz(quizQuestions);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz");
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [courseId, sectionId, questions.length, startQuiz]);

  // Cleanup on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!courseId || !sectionId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
        <CircleHelp className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No section selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a section from the Practice page to start quizzing.
        </p>
        <Link href="/questions">
          <Button variant="outline" size="sm" className="mt-4">
            Go to Practice
          </Button>
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="p-6">
        <QuizResults />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/questions" className="hover:text-foreground">Practice</Link>
        <span>/</span>
        <span className="text-foreground">Quiz</span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <QuestionCard
        question={currentQuestion}
        index={currentIndex}
        total={questions.length}
      />
    </div>
  );
}
