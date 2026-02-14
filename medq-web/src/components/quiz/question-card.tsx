"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  Sparkles,
  MessageCircleQuestion,
  Loader2,
} from "lucide-react";
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

  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const selectedIndex = answers.get(question.id);
  const isAnswered = selectedIndex !== undefined;
  const isCorrect = results.get(question.id) === true;
  const isLast = index === total - 1;
  const attemptId = getAttemptId(question.id);
  const correctOptionText = question.options[question.correctIndex] ?? "Not available";

  useEffect(() => {
    setSubmitting(false);
    setPendingIndex(null);
    setShowExplanation(false);
    setTutorResponse(null);
    setTutorLoading(false);
  }, [question.id]);

  async function handleSelect(optionIndex: number) {
    if (isAnswered || submitting) return;
    setPendingIndex(optionIndex);
    setSubmitting(true);
    try {
      const elapsed = Math.round((Date.now() - useQuizStore.getState().startTime) / 1000);
      const result = await fn.submitAttempt({
        questionId: question.id,
        answerIndex: optionIndex,
        timeSpentSec: Math.min(elapsed, 3600),
      });
      const correct = result.correct ?? optionIndex === question.correctIndex;
      answerQuestion(question.id, optionIndex, correct, result.attemptId);
      if (result.tutorResponse) {
        setTutorResponse(result.tutorResponse);
      }
    } catch (err) {
      console.warn("submitAttempt failed, using local check:", err);
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

  const difficultyLabel = ["", "Easy", "Easy", "Medium", "Hard", "Hard"][question.difficulty] || "Medium";
  const difficultyColor = question.difficulty <= 2
    ? "text-green-600 dark:text-green-400"
    : question.difficulty >= 4
      ? "text-red-600 dark:text-red-400"
      : "text-yellow-600 dark:text-yellow-400";

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-xs">
            {index + 1} / {total}
          </Badge>
          <Badge variant="secondary" className={`text-xs ${difficultyColor}`}>
            {difficultyLabel}
          </Badge>
        </div>
        <CardTitle className="mt-3 text-lg font-medium leading-relaxed">
          {question.stem}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {/* Options */}
        {question.options.map((option, i) => {
          const isSelected = selectedIndex === i;
          const isPending = pendingIndex === i && submitting;
          const isCorrectOption = i === question.correctIndex;

          let style = "border-border hover:border-primary/40 hover:bg-accent/50 cursor-pointer";
          if (isPending) {
            style = "border-primary bg-primary/5 cursor-wait";
          } else if (isAnswered) {
            if (isCorrectOption) {
              style = "border-green-500 bg-green-500/8";
            } else if (isSelected && !isCorrect) {
              style = "border-red-500 bg-red-500/8";
            } else {
              style = "border-border opacity-60";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={isAnswered || submitting}
              className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-all ${style} ${
                isAnswered ? "cursor-default" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isPending
                    ? "border-primary bg-primary text-primary-foreground"
                    : isAnswered && isCorrectOption
                      ? "bg-green-500 text-white"
                      : isAnswered && isSelected && !isCorrect
                        ? "bg-red-500 text-white"
                        : "border bg-muted"
                }`}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="flex-1 leading-relaxed">{option}</span>
              {isAnswered && isCorrectOption && (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              )}
              {isAnswered && isSelected && !isCorrect && (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              )}
            </button>
          );
        })}

        {/* Post-answer section */}
        {isAnswered && (
          <div className="space-y-3 pt-3">
            {/* Result banner */}
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
                isCorrect
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {isCorrect ? "Correct!" : `Incorrect \u2014 the answer is ${String.fromCharCode(65 + question.correctIndex)}`}
            </div>

            {/* Explanation toggle */}
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent/50"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="flex-1 text-left">Explanation</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  showExplanation ? "rotate-180" : ""
                }`}
              />
            </button>

            {showExplanation && question.explanation && (
              <div className="space-y-3 rounded-lg border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                    Why this is correct
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {question.explanation.correctWhy}
                  </p>
                </div>
                {question.explanation.whyOthersWrong?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                      Why other options are wrong
                    </p>
                    <ul className="space-y-1 text-sm leading-relaxed text-foreground/80">
                      {question.explanation.whyOthersWrong.map((reason, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">&bull;</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Key Takeaway
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed">
                      {question.explanation.keyTakeaway}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tutor section */}
            {!tutorResponse && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTutor}
                disabled={tutorLoading || !attemptId}
                className="gap-2"
              >
                {tutorLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                {tutorLoading ? "Thinking..." : "Ask AI Tutor"}
              </Button>
            )}

            {isAnswered && !attemptId && !tutorResponse && (
              <p className="text-xs text-muted-foreground">
                Tutor available once your answer syncs.
              </p>
            )}

            {tutorResponse && (
              <div className="overflow-hidden rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-4 py-2.5">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Tutor</span>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Correct Answer
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed">
                        {tutorResponse.correctAnswer || correctOptionText}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Explanation
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed">
                        {tutorResponse.whyCorrect || "No detail provided."}
                      </p>
                    </div>
                  </div>

                  {tutorResponse.whyStudentWrong && (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Where You Went Wrong
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed">
                          {tutorResponse.whyStudentWrong}
                        </p>
                      </div>
                    </div>
                  )}

                  {tutorResponse.keyTakeaway && (
                    <div className="flex items-start gap-3 rounded-md bg-primary/5 p-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                          Clinical Takeaway
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed">
                          {tutorResponse.keyTakeaway}
                        </p>
                      </div>
                    </div>
                  )}

                  {(tutorResponse.followUps?.length ?? 0) > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Test Yourself
                        </p>
                      </div>
                      <div className="space-y-2">
                        {tutorResponse.followUps.slice(0, 2).map((item, i) => (
                          <details key={i} className="group rounded-md border bg-muted/30">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-accent/50">
                              {item.q}
                            </summary>
                            <div className="border-t px-3 py-2 text-sm text-muted-foreground">
                              {item.a}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-end pt-1">
              <Button onClick={isLast ? finishQuiz : nextQuestion} className="gap-1">
                {isLast ? "Finish Quiz" : "Next Question"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
