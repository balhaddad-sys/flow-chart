"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, RotateCcw, Home, AlertTriangle, TrendingUp } from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NumberTicker } from "@/components/ui/animate-in";
import { Confetti } from "@/components/ui/confetti";
import { XpBadge, calculateXp } from "@/components/ui/xp-badge";
import { computeQuizWeakness, type TopicWeakness } from "@/lib/utils/quiz-weakness";
import { cn } from "@/lib/utils";

function severityBadge(severity: TopicWeakness["severity"]) {
  if (severity === "CRITICAL") {
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0">Critical</Badge>;
  }
  if (severity === "REINFORCE") {
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">Reinforce</Badge>;
  }
  return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">Strong</Badge>;
}

export function QuizResults() {
  const router = useRouter();
  const { questions, answers, results, endedEarly, reset } = useQuizStore();

  const answered = answers.size;
  const correct = Array.from(results.values()).filter(Boolean).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const xp = calculateXp(correct, 0);
  const skipped = questions.length - answered;

  const profile = useMemo(
    () => computeQuizWeakness(questions, results, answers),
    [questions, results, answers],
  );

  const confettiIntensity = accuracy >= 100 ? "high" : accuracy >= 90 ? "medium" : "low";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Confetti trigger={accuracy >= 80 && !endedEarly} intensity={confettiIntensity} />

      <div className="glass-card overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="text-center space-y-4 animate-in-up stagger-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {endedEarly ? "Quiz Ended Early" : "Quiz Complete"}
          </h2>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 animate-in-scale stagger-2">
          <ProgressRing
            value={accuracy}
            size={120}
            strokeWidth={8}
            color={accuracy >= 80 ? "oklch(0.70 0.18 155)" : accuracy >= 50 ? "oklch(0.75 0.16 85)" : "oklch(0.60 0.22 30)"}
            label={`${accuracy}%`}
          />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              <NumberTicker value={correct} className="font-bold text-foreground" /> out of{" "}
              <span className="font-bold text-foreground">{answered}</span> correct
              {skipped > 0 && (
                <span className="text-muted-foreground/70">
                  {" "}({skipped} skipped)
                </span>
              )}
            </p>
          </div>
          {xp > 0 && (
            <div className="animate-in-bounce stagger-3">
              <XpBadge xp={xp} size="lg" />
            </div>
          )}
        </div>

        {/* Topic weakness breakdown */}
        {profile.hasEnoughData && profile.topics.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Topic Breakdown</h3>
            </div>

            {profile.topics.map((topic) => (
              <div
                key={topic.rawTag}
                className="rounded-xl border border-border/70 bg-background/70 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{topic.tag}</p>
                    <p className="text-xs text-muted-foreground">
                      {topic.correct}/{topic.attempted} correct
                    </p>
                  </div>
                  {severityBadge(topic.severity)}
                </div>

                <Progress value={topic.accuracy} className="mt-3 h-2" />

                {topic.severity !== "STRONG" && (
                  <Link
                    href={`/ai/explore?topic=${encodeURIComponent(topic.rawTag)}&autostart=learn`}
                    className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Review {topic.tag} in Explore
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Question recap */}
        <div className="mt-8 space-y-2">
          {questions.map((q, i) => {
            const isCorrect = results.get(q.id);
            const wasAnswered = answers.has(q.id);
            return (
              <div
                key={q.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border/60 bg-background/65 p-3 text-sm",
                  !wasAnswered && "opacity-50",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {wasAnswered ? (
                  isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )
                ) : (
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-border/60" />
                )}
                <span className="text-muted-foreground tabular-nums">Q{i + 1}:</span>
                <span className="flex-1 truncate">{q.stem}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3 animate-in-up stagger-4">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => {
              reset();
              router.back();
            }}
          >
            <Home className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={() => {
              reset();
              window.location.reload();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
