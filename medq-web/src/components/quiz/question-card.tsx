"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ChevronRight, Lightbulb } from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";
import * as fn from "@/lib/firebase/functions";
import type { TutorResponse } from "@/lib/firebase/functions";
import { toast } from "sonner";
import type { QuestionModel } from "@/lib/types/question";

interface QuestionCardProps {
  question: QuestionModel;
  index: number;
  total: number;
}

export function QuestionCard({ question, index, total }: QuestionCardProps) {
  const { answers, results, answerQuestion, nextQuestion, finishQuiz, getAttemptId } = useQuizStore();
  const [submitting, setSubmitting] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);

  const selectedIndex = answers.get(question.id);
  const isAnswered = selectedIndex !== undefined;
  const isCorrect = results.get(question.id) === true;
  const isLast = index === total - 1;
  const attemptId = getAttemptId(question.id);
  const correctOptionText = question.options[question.correctIndex] ?? "Not available";

  useEffect(() => {
    setSubmitting(false);
    setShowExplanation(false);
    setTutorResponse(null);
    setTutorLoading(false);
  }, [question.id]);

  async function handleSelect(optionIndex: number) {
    if (isAnswered || submitting) return;
    setSubmitting(true);
    try {
      const result = await fn.submitAttempt({
        questionId: question.id,
        answerIndex: optionIndex,
        timeSpentSec: Math.round((Date.now() - useQuizStore.getState().startTime) / 1000),
      });
      const correct = result.correct ?? optionIndex === question.correctIndex;
      answerQuestion(question.id, optionIndex, correct, result.attemptId);
      if (result.tutorResponse) {
        setTutorResponse(result.tutorResponse);
      }
    } catch {
      // Fallback to local check if function fails
      const correct = optionIndex === question.correctIndex;
      answerQuestion(question.id, optionIndex, correct);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTutor() {
    if (tutorResponse || tutorLoading) return;
    if (!attemptId) {
      toast.error("Tutor help is available after your answer is synced.");
      return;
    }

    setTutorLoading(true);
    try {
      const result = await fn.getTutorHelp({
        questionId: question.id,
        attemptId,
      });
      setTutorResponse(result.tutorResponse);
    } catch {
      toast.error("Tutor unavailable right now.");
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
              <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                <p><strong>Correct answer:</strong> {correctOptionText}</p>
                <p><strong>Why this is correct:</strong> {question.explanation.correctWhy}</p>
                <p><strong>Key takeaway:</strong> {question.explanation.keyTakeaway}</p>
              </div>
            )}

            {/* Tutor help */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTutor}
              disabled={tutorLoading || !attemptId || Boolean(tutorResponse)}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {tutorLoading ? "Asking tutor..." : tutorResponse ? "Tutor ready" : "Ask Tutor"}
            </Button>

            {isAnswered && !attemptId && (
              <p className="text-xs text-muted-foreground">
                Tutor help is temporarily unavailable while answer sync is pending.
              </p>
            )}

            {tutorResponse && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                <p><strong>Correct answer:</strong> {tutorResponse.correctAnswer || correctOptionText}</p>
                <p><strong>Why this is correct:</strong> {tutorResponse.whyCorrect || "No detail provided."}</p>
                {tutorResponse.whyStudentWrong && (
                  <p><strong>Why your choice was incorrect:</strong> {tutorResponse.whyStudentWrong}</p>
                )}
                {tutorResponse.keyTakeaway && (
                  <p><strong>Clinical takeaway:</strong> {tutorResponse.keyTakeaway}</p>
                )}
                {(tutorResponse.followUps?.length ?? 0) > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="font-semibold">Follow-up checks</p>
                    {tutorResponse.followUps.slice(0, 2).map((item, i) => (
                      <p key={i}>
                        <strong>Q:</strong> {item.q} <strong>A:</strong> {item.a}
                      </p>
                    ))}
                  </div>
                )}
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
