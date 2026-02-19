"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Home } from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NumberTicker } from "@/components/ui/animate-in";
import { Confetti } from "@/components/ui/confetti";
import { XpBadge, calculateXp } from "@/components/ui/xp-badge";

export function QuizResults() {
  const router = useRouter();
  const { questions, results, reset } = useQuizStore();

  const total = questions.length;
  const correct = Array.from(results.values()).filter(Boolean).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const xp = calculateXp(correct, 0);

  const confettiIntensity = accuracy >= 100 ? "high" : accuracy >= 90 ? "medium" : "low";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Confetti trigger={accuracy >= 80} intensity={confettiIntensity} />

      <div className="glass-card overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="text-center space-y-4 animate-in-up stagger-1">
          <h2 className="text-xl font-semibold tracking-tight">Quiz Complete</h2>
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
              <span className="font-bold text-foreground">{total}</span> correct
            </p>
          </div>
          {xp > 0 && (
            <div className="animate-in-bounce stagger-3">
              <XpBadge xp={xp} size="lg" />
            </div>
          )}
        </div>

        {/* Question recap */}
        <div className="mt-8 space-y-2">
          {questions.map((q, i) => {
            const isCorrect = results.get(q.id);
            return (
              <div
                key={q.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/65 p-3 text-sm"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
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
