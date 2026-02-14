"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ChevronRight, Lightbulb } from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";
import type { QuestionModel } from "@/lib/types/question";

interface QuestionCardProps {
  question: QuestionModel;
  index: number;
  total: number;
}

export function QuestionCard({ question, index, total }: QuestionCardProps) {
  const { answers, results, answerQuestion, nextQuestion, finishQuiz } = useQuizStore();
  const [submitting, setSubmitting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [tutorText, setTutorText] = useState<string | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const selectedIndex = answers.get(question.id);
  const isAnswered = selectedIndex !== undefined;
  const isCorrect = results.get(question.id);
  const isLast = index === total - 1;

  async function handleSelect(optionIndex: number) {
    if (isAnswered || submitting) return;
    setSubmitting(true);
    try {
      const result = await fn.submitAttempt({
        questionId: question.id,
        answerIndex: optionIndex,
        timeSpentSec: Math.round((Date.now() - useQuizStore.getState().startTime) / 1000),
      });
      const typedResult = result as { correct?: boolean; attemptId?: string };
      const correct = typedResult.correct ?? optionIndex === question.correctIndex;
      if (typedResult.attemptId) setAttemptId(typedResult.attemptId);
      answerQuestion(question.id, optionIndex, correct);
    } catch {
      // Fallback to local check if function fails
      const correct = optionIndex === question.correctIndex;
      answerQuestion(question.id, optionIndex, correct);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTutor() {
    if (tutorText || tutorLoading) return;
    setTutorLoading(true);
    try {
      const result = await fn.getTutorHelp({
        questionId: question.id,
        attemptId: attemptId ?? "",
      });
      const tutor = (result as { tutorResponse?: { whyCorrect?: string; correctAnswer?: string } }).tutorResponse;
      setTutorText(tutor?.whyCorrect || tutor?.correctAnswer || "No explanation available.");
    } catch {
      toast.error("Tutor unavailable right now.");
      setTutorText("Tutor unavailable right now. Try again later.");
    } finally {
      setTutorLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            Question {index + 1} of {total}
          </Badge>
          <Badge variant="secondary">
            Difficulty {question.difficulty}/5
          </Badge>
        </div>
        <CardTitle className="mt-3 text-lg leading-relaxed">
          {question.stem}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {question.options.map((option, i) => {
          const isSelected = selectedIndex === i;
          const isCorrectOption = i === question.correctIndex;
          let borderColor = "border-border";
          let bgColor = "";

          if (isAnswered) {
            if (isCorrectOption) {
              borderColor = "border-green-500";
              bgColor = "bg-green-500/10";
            } else if (isSelected && !isCorrect) {
              borderColor = "border-red-500";
              bgColor = "bg-red-500/10";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={isAnswered || submitting}
              className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left text-sm transition-colors ${borderColor} ${bgColor} ${
                !isAnswered ? "hover:bg-accent/50 cursor-pointer" : ""
              }`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{option}</span>
              {isAnswered && isCorrectOption && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              )}
              {isAnswered && isSelected && !isCorrect && (
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              )}
            </button>
          );
        })}

        {isAnswered && (
          <div className="space-y-3 pt-3">
            {/* Explanation */}
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-sm text-primary hover:underline"
            >
              {showExplanation ? "Hide explanation" : "Show explanation"}
            </button>

            {showExplanation && question.explanation && (
              <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
                <p><strong>Why correct:</strong> {question.explanation.correctWhy}</p>
                <p><strong>Key takeaway:</strong> {question.explanation.keyTakeaway}</p>
              </div>
            )}

            {/* Tutor help */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTutor}
              disabled={tutorLoading}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {tutorLoading ? "Asking tutor..." : "Ask Tutor"}
            </Button>

            {tutorText && (
              <div className="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-950/30">
                {tutorText}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-end pt-2">
              <Button onClick={isLast ? finishQuiz : nextQuestion}>
                {isLast ? "Finish Quiz" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
