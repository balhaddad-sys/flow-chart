"use client";

import Link from "next/link";
import { useFiles } from "@/lib/hooks/useFiles";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { FileUploadZone } from "@/components/library/file-upload-zone";
import { FileCard } from "@/components/library/file-card";
import { InlineLoadingState, ListLoadingState } from "@/components/ui/loading-state";
import { Upload, ArrowRight } from "lucide-react";

export default function LibraryPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files, loading } = useFiles(courseId);
  const { tasks, loading: tasksLoading } = useTasks(courseId);
  const hasFiles = files.length > 0;
  const hasPlan = tasks.length > 0;
  const backgroundProcessingCount = files.filter(
    (file) => file.status === "UPLOADED" || file.status === "PROCESSING"
  ).length;

  return (
    <div className="page-wrap page-stack">

      {/* Header */}
      <div className="animate-in-up">
        <h1 className="page-title">Library</h1>
        <p className="page-subtitle">
          Upload study materials and let AI extract structured sections for quizzing.
        </p>
      </div>

      {/* Upload zone */}
      <FileUploadZone />

      {/* File list */}
      <div className="space-y-3">
        {loading ? (
          <ListLoadingState rows={4} />
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 mb-3">
              <Upload className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold">No materials uploaded yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground max-w-xs">
              Drag a PDF, DOCX, or PPTX above to get started.
            </p>
          </div>
        ) : (
          <>
            {backgroundProcessingCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-glow-pulse" />
                <span className="text-[13px] text-amber-700 dark:text-amber-300">
                  AI is analysing {backgroundProcessingCount} file{backgroundProcessingCount === 1 ? "" : "s"}. This usually takes 1-3 minutes.
                </span>
              </div>
            )}

            {hasFiles && !hasPlan && backgroundProcessingCount === 0 && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {tasksLoading ? (
                    <InlineLoadingState label="Checking your plan status..." />
                  ) : (
                    "All files analysed — your study plan will be generated automatically."
                  )}
                </p>
                <Link
                  href="/today"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Go to Home
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id}>
                  <FileCard file={file} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
