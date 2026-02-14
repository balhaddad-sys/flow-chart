"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, CheckCircle2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTimerStore } from "@/lib/stores/timer-store";
import { updateTask } from "@/lib/firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { SectionModel } from "@/lib/types/section";

export default function StudySessionPage({
  params,
}: {
  params: Promise<{ taskId: string; sectionId: string }>;
}) {
  const { taskId, sectionId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const { seconds, isRunning, start, pause, reset, getFormatted } = useTimerStore();
  const [section, setSection] = useState<SectionModel | null>(null);

  // Load section data
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid, "sections", sectionId), (snap) => {
      if (snap.exists()) {
        setSection({ ...snap.data(), id: snap.id } as SectionModel);
      }
    });
    return unsub;
  }, [uid, sectionId]);

  // Auto-start timer
  useEffect(() => {
    start();
    return () => {
      pause();
      reset();
    };
  }, [start, pause, reset]);

  async function handleComplete() {
    if (!uid) return;
    pause();
    const minutes = Math.ceil(seconds / 60);
    await updateTask(uid, taskId, {
      status: "DONE",
      actualMinutes: minutes,
    });
    reset();
    router.push("/planner");
  }

  const formatted = getFormatted();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Study Session</h1>
          {section && (
            <p className="text-sm text-muted-foreground">{section.title}</p>
          )}
        </div>
      </div>

      {/* Timer */}
      <Card>
        <CardContent className="flex items-center justify-center gap-6 py-8">
          <div className="text-center">
            <p className="text-5xl font-mono font-bold tabular-nums">{formatted}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {section?.estMinutes ? `Target: ${section.estMinutes} minutes` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="outline" size="icon" onClick={pause}>
                <Pause className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="outline" size="icon" onClick={start}>
                <Play className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleComplete}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section blueprint */}
      {section?.blueprint && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Study Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.blueprint.learningObjectives.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Learning Objectives</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {section.blueprint.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.blueprint.keyConcepts.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Key Concepts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {section.blueprint.keyConcepts.map((concept, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {concept}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {section.blueprint.highYieldPoints.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">High-Yield Points</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {section.blueprint.highYieldPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.blueprint.commonTraps.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Common Traps</h3>
                <ul className="list-disc pl-5 text-sm text-orange-600 dark:text-orange-400 space-y-1">
                  {section.blueprint.commonTraps.map((trap, i) => (
                    <li key={i}>{trap}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
