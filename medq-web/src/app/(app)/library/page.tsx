"use client";

import Link from "next/link";
import { useFiles } from "@/lib/hooks/useFiles";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { FileUploadZone } from "@/components/library/file-upload-zone";
import { FileCard } from "@/components/library/file-card";
import { InlineLoadingState, ListLoadingState } from "@/components/ui/loading-state";
import { Library, Upload, ArrowRight } from "lucide-react";

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

      {/* Page header */}
      <div className="glass-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="flex items-start gap-4 p-6 sm:p-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12">
            <Library className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="section-label animate-in-up stagger-1">Materials</p>
            <h1 className="page-title animate-in-up stagger-2">Library</h1>
            <p className="page-subtitle animate-in-up stagger-3">
              Upload your study materials once and let AI extract, analyse, and organise them into structured sections ready for quizzing.
            </p>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <div className="animate-in-up stagger-3">
        <FileUploadZone />
      </div>

      {/* File list */}
      <div className="space-y-3">
        {loading ? (
          <ListLoadingState rows={4} />
        ) : files.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center rounded-2xl border-dashed py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/70">
              <Upload className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="font-semibold">No materials uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Drag a PDF, DOCX, or PPTX above to get started. AI will analyse and extract study sections automatically.
            </p>
          </div>
        ) : (
          <>
            {backgroundProcessingCount > 0 && (
              <div className="glass-card flex items-center gap-3 px-5 py-3.5 animate-in-up">
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-glow-pulse" />
                <span className="text-sm text-muted-foreground">
                  Sit tight — AI is analysing {backgroundProcessingCount} file{backgroundProcessingCount === 1 ? "" : "s"}. This usually takes 1–3 minutes. You can keep using the app.
                </span>
              </div>
            )}

            {hasFiles && !hasPlan && backgroundProcessingCount === 0 && (
              <div className="glass-card flex items-center justify-between gap-4 border-primary/15 px-5 py-3.5 animate-in-up">
                <p className="text-sm text-muted-foreground">
                  {tasksLoading ? (
                    <InlineLoadingState label="Checking your plan status..." />
                  ) : (
                    "All files analysed — your study plan will be generated automatically. Check your Today page soon!"
                  )}
                </p>
                <Link
                  href="/today"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Go to Today
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <div className="space-y-2.5">
              {files.map((file, i) => (
                <div key={file.id} style={{ animationDelay: `${i * 50}ms` }} className="animate-in-up">
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
