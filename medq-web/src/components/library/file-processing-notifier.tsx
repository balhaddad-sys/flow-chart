"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCourseStore } from "@/lib/stores/course-store";
import { useFiles } from "@/lib/hooks/useFiles";

/**
 * Global file-processing notifier.
 * Watches file status transitions and notifies the user when background processing completes.
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

    for (const file of files) {
      const previous = previousStatuses.get(file.id);
      if (!previous || previous === file.status) continue;

      if (file.status === "READY") {
        toast.success(`${file.originalName} finished processing. It is ready to use.`);
      } else if (file.status === "FAILED") {
        toast.error(`${file.originalName} failed to process. Open Library to retry.`);
      }
    }

    previousStatusesRef.current = currentStatuses;
  }, [courseId, files]);

  return null;
}
