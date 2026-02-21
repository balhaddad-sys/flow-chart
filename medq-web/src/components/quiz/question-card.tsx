"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineLoadingState, LoadingButtonLabel } from "@/components/ui/loading-state";
import {
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  Sparkles,
  MessageCircleQuestion,
  Loader2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";
import * as fn from "@/lib/firebase/functions";
import type { TutorResponse } from "@/lib/firebase/functions";
import { toast } from "sonner";
import type { QuestionModel } from "@/lib/types/question";
import { FlagQuestionDialog } from "./flag-question-dialog";
import { SourceCitationDrawer } from "./source-citation-drawer";
import { cn } from "@/lib/utils";

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

  const isDraft = question.quality === "draft";
  const hasSourceCitations =
    (question.sourceCitations?.length ?? 0) > 0 ||
    (question.citations?.length ?? 0) > 0 ||
    !!question.sourceRef?.label;

  useEffect(() => {
    setSubmitting(false);
    setPendingIndex(null);
    setShowExplanation(false);
    setTutorResponse(null);
    setTutorLoading(false);
  }, [question.id]);

  // Keyboard shortcuts: A–D or 1–4 to select, Enter to advance, Escape to go back
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const keyMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
      const optionIndex = keyMap[e.key.toLowerCase()];

      if (optionIndex !== undefined && optionIndex < question.options.length && !isAnswered && !submitting) {
        e.preventDefault();
        handleSelect(optionIndex);
      } else if (e.key === "Enter" && isAnswered) {
        e.preventDefault();
        if (isLast) finishQuiz();
        else nextQuestion();
      } else if (e.key === "Escape") {
        e.preventDefault();
        window.history.back();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, isAnswered, submitting, isLast]);

  async function handleSelect(optionIndex: number) {
    if (isAnswered || submitting) return;
    setPendingIndex(optionIndex);
    setSubmitting(true);

    // ── Optimistic update: reflect result immediately in the UI ──────────
    const optimisticCorrect = optionIndex === question.correctIndex;
    answerQuestion(question.id, optionIndex, optimisticCorrect);

    try {
      const elapsed = Math.round((Date.now() - useQuizStore.getState().startTime) / 1000);
      // Fire-and-forget to backend; UI already shows the result
      fn.submitAttempt({
        questionId: question.id,
        answerIndex: optionIndex,
        timeSpentSec: Math.min(elapsed, 3600),
      }).then((result) => {
        // Reconcile: if the backend disagrees (extremely rare), quietly update
        if (result.correct !== optimisticCorrect) {
          answerQuestion(question.id, optionIndex, result.correct, result.attemptId);
        } else if (result.attemptId) {
          answerQuestion(question.id, optionIndex, result.correct, result.attemptId);
        }
        if (result.tutorResponse) setTutorResponse(result.tutorResponse);
      }).catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        console.error("[QuestionCard] submitAttempt failed:", detail, { questionId: question.id });
        toast.error(`Answer couldn\u2019t sync: ${detail}`);
      });
    } finally {
      setSubmitting(false);
      setPendingIndex(null);
    }
  }

  async function handleTutor() {
    if (tutorResponse || tutorLoading) return;
    if (!attemptId) {
      // Tutor is available even without attemptId for sample deck questions
      toast.error("Tutor help will be available once your answer syncs.");
      return;
    }
    setTutorLoading(true);
    try {
      const result = await fn.getTutorHelp({ questionId: question.id, attemptId });
      setTutorResponse(result.tutorResponse);
    } catch {
      toast.error("Tutor unavailable right now.");
    } finally {
      setTutorLoading(false);
    }
  }

  const difficultyLabel = ["", "Easy", "Easy", "Medium", "Hard", "Hard"][question.difficulty] || "Medium";
  const difficultyColor =
    question.difficulty <= 2
      ? "text-green-600 dark:text-green-400"
      : question.difficulty >= 4
      ? "text-red-600 dark:text-red-400"
      : "text-yellow-600 dark:text-yellow-400";

  return (
    <Card className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-in-up">
      <CardHeader className="pb-3">
        {/* Top meta row — minimal, out of the way */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold tabular-nums text-muted-foreground">
              {index + 1}<span className="text-muted-foreground/40">/{total}</span>
            </span>
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${difficultyColor}`}>
              {difficultyLabel}
            </Badge>
            {isDraft && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/8 text-amber-600 dark:text-amber-400 text-[10px] gap-1"
              >
                <ShieldAlert className="h-2.5 w-2.5" />
                Draft
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {hasSourceCitations && (
              <SourceCitationDrawer
                sourceCitations={question.sourceCitations}
                citations={question.citations}
                sourceRef={question.sourceRef}
              />
            )}
            <FlagQuestionDialog questionId={question.id} />
          </div>
        </div>

        {/* The question — hero element, maximum readability */}
        <p className="mt-4 text-[17px] font-medium leading-[1.6] tracking-[-0.01em]">{question.stem}</p>

        {/* Topic tags — subtle */}
        {question.topicTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {question.topicTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Answer options */}
        {question.options.map((option, i) => {
          const isSelected = selectedIndex === i;
          const isPending = pendingIndex === i && submitting;
          const isCorrectOption = i === question.correctIndex;

          let style =
            "border-border/60 bg-background hover:border-primary/40 hover:bg-primary/[0.03] cursor-pointer";
          if (isPending) {
            style = "border-primary bg-primary/5 cursor-wait";
          } else if (isAnswered) {
            if (isCorrectOption) {
              style = "border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-500/10";
            } else if (isSelected && !isCorrect) {
              style = "border-amber-400/50 bg-amber-50/80 dark:bg-amber-500/10";
            } else {
              style = "border-border/40 opacity-45";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={isAnswered || submitting}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-[14px] transition-all duration-150",
                style,
                isAnswered ? "cursor-default" : ""
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-all",
                  isPending
                    ? "bg-primary text-primary-foreground"
                    : isAnswered && isCorrectOption
                    ? "bg-emerald-500 text-white"
                    : isAnswered && isSelected && !isCorrect
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="flex-1 leading-relaxed">{option}</span>
              {isAnswered && isCorrectOption && (
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
              )}
            </button>
          );
        })}

        {/* Keyboard hint — desktop only */}
        {!isAnswered && !submitting && (
          <p className="hidden text-center text-[11px] text-muted-foreground/50 md:block">
            Press{" "}
            <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">A</kbd>
            –
            <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">D</kbd>
            {" "}to select ·{" "}
            <kbd className="rounded border border-border/60 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">Enter</kbd>
            {" "}to advance
          </p>
        )}

        {/* ── Post-answer section ──────────────────────────────────── */}
        {isAnswered && (
          <div className="space-y-3 pt-3 animate-in-up">
            {/* Result banner — clean, supportive */}
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-semibold",
                isCorrect
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              )}
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Correct
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  The answer is {String.fromCharCode(65 + question.correctIndex)}
                </>
              )}
            </div>

            {/* Explore topic prompt — shown on wrong answers */}
            {!isCorrect && question.topicTags.length > 0 && (() => {
              const specificTopic = question.topicTags[question.topicTags.length - 1];
              const examParam = question.id.startsWith("exambank_") && question.courseId
                ? `&exam=${encodeURIComponent(question.courseId)}`
                : "";
              return (
                <Link
                  href={`/ai/explore?topic=${encodeURIComponent(specificTopic)}&autostart=learn${examParam}`}
                  className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 text-foreground/90">
                    Want to review <span className="font-medium text-primary">{specificTopic}</span> in depth?
                  </span>
                  <span className="text-xs font-medium text-primary whitespace-nowrap">Explore →</span>
                </Link>
              );
            })()}

            {/* Explanation toggle */}
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent/45"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="flex-1 text-left">Explanation</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  showExplanation && "rotate-180"
                )}
              />
            </button>

            {showExplanation && question.explanation && (
              <div className="space-y-3 rounded-xl border border-border/70 bg-background/75 p-4 transition-all">
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Why other options are incorrect
                    </p>
                    <ul className="space-y-1 text-sm leading-relaxed text-foreground/80">
                      {question.explanation.whyOthersWrong.map((reason, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">–</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-primary/6 p-3">
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

                {/* URL citations */}
                {(question.citations?.length ?? 0) > 0 && (
                  <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Clinical References
                    </p>
                    <div className="space-y-1.5">
                      {question.citations?.slice(0, 3).map((citation, i) => (
                        <a
                          key={`${citation.url}_${i}`}
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-sm transition-colors hover:bg-accent/40"
                        >
                          <span className="font-medium text-primary text-xs">{citation.source}</span>
                          <span className="flex-1 text-foreground/85 text-xs">{citation.title}</span>
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Tutor */}
            {!tutorResponse && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTutor}
                disabled={tutorLoading || (!attemptId && !question.isSampleDeck)}
                className="gap-2"
              >
                {tutorLoading ? (
                  <LoadingButtonLabel label="Thinking…" />
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4" />
                    Ask AI Tutor
                  </>
                )}
              </Button>
            )}

            {isAnswered && !attemptId && !tutorResponse && !question.isSampleDeck && (
              <InlineLoadingState className="text-xs" label="Tutor available once your answer syncs." />
            )}

            {tutorResponse && (
              <div className="overflow-hidden rounded-xl border border-primary/20">
                <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-4 py-2.5">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">AI Tutor</span>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Correct Answer</p>
                      <p className="mt-0.5 text-sm leading-relaxed">
                        {tutorResponse.correctAnswer || correctOptionText}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explanation</p>
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
                          Why that option was tempting
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed">{tutorResponse.whyStudentWrong}</p>
                      </div>
                    </div>
                  )}

                  {tutorResponse.keyTakeaway && (
                    <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                          Clinical Takeaway
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed">{tutorResponse.keyTakeaway}</p>
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
                          <details key={i} className="group rounded-lg border border-border/70 bg-muted/30">
                            <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-accent/50 select-none">
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
