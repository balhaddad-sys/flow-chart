"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCourseStore } from "@/lib/stores/course-store";
import { useFiles } from "@/lib/hooks/useFiles";

/**
 * Global file-processing notifier.
 * Watches file status transitions and notifies the user:
 * - When processing starts: encouraging "sit tight" message
 * - When fully done (READY): celebratory completion message
 * - When ALL course files finish: study plan auto-generated message
 * - When failed: actionable error message
 */
export function FileProcessingNotifier() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files } = useFiles(courseId);
  const initialisedRef = useRef(false);
  const previousStatusesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!courseId) {
      initialisedRef.current = false;
      previousStatusesRef.current = new Map();
      return;
    }

    const currentStatuses = new Map(files.map((file) => [file.id, file.status]));

    if (!initialisedRef.current) {
      previousStatusesRef.current = currentStatuses;
      initialisedRef.current = true;
      return;
    }

    const previousStatuses = previousStatusesRef.current;
    let newlyReadyCount = 0;

    for (const file of files) {
      const previous = previousStatuses.get(file.id);
      if (!previous || previous === file.status) continue;

      if (file.status === "PROCESSING" && previous === "UPLOADED") {
        toast(`Analysing ${file.originalName} — sit tight, this usually takes a couple of minutes.`, {
          duration: 5000,
        });
      } else if (file.status === "READY") {
        newlyReadyCount++;
      } else if (file.status === "FAILED") {
        toast.error(`${file.originalName} failed to process. Open Library to retry.`);
      }
    }

    // Check if ALL files are now done (READY or FAILED) and at least one just finished
    if (newlyReadyCount > 0) {
      const allDone = files.length > 0 && files.every(
        (f) => f.status === "READY" || f.status === "FAILED"
      );
      const anyReady = files.some((f) => f.status === "READY");

      if (allDone && anyReady) {
        toast.success(
          "All files fully analysed! Your study plan is being generated automatically.",
          { duration: 8000 }
        );
      } else if (newlyReadyCount === 1) {
        const readyFile = files.find(
          (f) => f.status === "READY" && previousStatuses.get(f.id) !== "READY"
        );
        if (readyFile) {
          toast.success(
            `${readyFile.originalName} is fully analysed! Sections and questions are ready.`,
            { duration: 6000 }
          );
        }
      } else {
        toast.success(
          `${newlyReadyCount} files fully analysed! Sections and questions are ready.`,
          { duration: 6000 }
        );
      }
    }

    previousStatusesRef.current = currentStatuses;
  }, [courseId, files]);

  return null;
}
