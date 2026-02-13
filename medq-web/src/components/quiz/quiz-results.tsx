"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, RotateCcw, Home } from "lucide-react";
import { useQuizStore } from "@/lib/stores/quiz-store";

export function QuizResults() {
  const router = useRouter();
  const { questions, results, reset } = useQuizStore();

  const total = questions.length;
  const correct = Array.from(results.values()).filter(Boolean).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Quiz Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-5xl font-bold">{accuracy}%</p>
            <p className="mt-1 text-muted-foreground">
              {correct} out of {total} correct
            </p>
          </div>
          <Progress value={accuracy} className="h-3" />

          <div className="space-y-2">
            {questions.map((q, i) => {
              const isCorrect = results.get(q.id);
              return (
                <div key={q.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  {isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <span className="text-muted-foreground">Q{i + 1}:</span>
                  <span className="flex-1 truncate">{q.stem}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                reset();
                router.back();
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                reset();
                router.refresh();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
