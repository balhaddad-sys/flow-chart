"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useExploreStore } from "@/lib/stores/explore-store";

export function ExploreResults() {
  const {
    questions,
    answers,
    results,
    topic,
    levelLabel,
    targetCount,
    backfillStatus,
    resumeQuiz,
    reset,
  } =
    useExploreStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const total = questions.length;
  const target = Math.max(total, targetCount || 0);
  const answered = answers.size;
  const unanswered = Math.max(0, total - answered);
  const correct = Array.from(results.values()).filter(Boolean).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Explore Complete</CardTitle>
          <div className="flex justify-center gap-2 pt-2">
            <Badge variant="secondary">{topic}</Badge>
            <Badge variant="outline">{levelLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-5xl font-semibold">{accuracy}%</p>
            <p className="mt-1 text-muted-foreground">
              {correct} out of {answered} answered correctly
            </p>
            {target > total && (
              <p className="mt-1 text-xs text-muted-foreground">
                {total}/{target} questions ready so far
              </p>
            )}
            {backfillStatus === "running" && (
              <p className="mt-1 text-xs text-muted-foreground">
                More questions are still being generated in background.
              </p>
            )}
            {unanswered > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {unanswered} question{unanswered === 1 ? "" : "s"} unanswered.
              </p>
            )}
          </div>
          <Progress value={accuracy} className="h-3" />

          <div className="space-y-2">
            {questions.map((q, i) => {
              const isCorrect = results.get(q.id);
              const isExpanded = expandedId === q.id;
              const selectedIdx = answers.get(q.id);

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-border/70 bg-background/65"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="flex w-full items-start gap-3 p-3 text-left text-sm"
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <span className="text-muted-foreground">Q{i + 1}:</span>
                    <span className="flex-1 line-clamp-1">{q.stem}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 border-t border-border/70 p-3 text-sm">
                      <p>
                        <span className="font-medium">Your answer:</span>{" "}
                        {selectedIdx != null
                          ? `${String.fromCharCode(65 + selectedIdx)}. ${q.options[selectedIdx]}`
                          : "—"}
                      </p>
                      <p>
                        <span className="font-medium">Correct:</span>{" "}
                        {String.fromCharCode(65 + q.correctIndex)}.{" "}
                        {q.options[q.correctIndex]}
                      </p>
                      {q.explanation?.keyTakeaway && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Key takeaway
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            {q.explanation.keyTakeaway}
                          </p>
                        </div>
                      )}
                      {q.explanation?.correctWhy && (
                        <p className="text-muted-foreground">
                          {q.explanation.correctWhy}
                        </p>
                      )}
                      {selectedIdx != null &&
                        q.explanation?.whyOthersWrong?.[selectedIdx] && (
                          <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              Your option reasoning
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {q.explanation.whyOthersWrong[selectedIdx]}
                            </p>
                          </div>
                        )}
                      {(q.explanation?.whyOthersWrong?.length ?? 0) > 0 && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Option-by-option reasoning
                          </p>
                          <div className="mt-2 space-y-1">
                            {q.explanation.whyOthersWrong
                              .slice(0, q.options.length)
                              .map((reason, optionIndex) => (
                                <p
                                  key={`${q.id}_${optionIndex}`}
                                  className="text-muted-foreground"
                                >
                                  {String.fromCharCode(65 + optionIndex)}. {reason}
                                </p>
                              ))}
                          </div>
                        </div>
                      )}
                      {(q.citations?.length ?? 0) > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Verified sources
                          </p>
                          {q.citations?.slice(0, 3).map((citation, idx) => (
                            <a
                              key={`${citation.url}_${idx}`}
                              href={citation.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 text-sm transition-colors hover:bg-accent/40"
                            >
                              <span className="font-medium text-primary">{citation.source}</span>
                              <span className="flex-1 text-muted-foreground">{citation.title}</span>
                              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unanswered > 0 && (
            <Button className="w-full" onClick={resumeQuiz}>
              Continue Quiz
            </Button>
          )}

          <Button className="w-full" variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New Topic
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
