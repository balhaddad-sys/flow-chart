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
      <div className="glass-card p-5 sm:p-6 animate-in-up">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Library className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="page-title">Library</h1>
            <p className="page-subtitle">
              Upload your study materials and let AI extract, analyse, and organise them into structured sections ready for quizzing.
            </p>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <div className="animate-in-up stagger-1">
        <FileUploadZone />
      </div>

      {/* File list */}
      <div className="space-y-3">
        {loading ? (
          <ListLoadingState rows={4} />
        ) : files.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No materials uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Drag a PDF, DOCX, or PPTX above to get started. AI will analyse and extract study sections automatically.
            </p>
          </div>
        ) : (
          <>
            {backgroundProcessingCount > 0 && (
              <div className="glass-card flex items-center gap-3 px-4 py-3 animate-in-up">
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-glow-pulse" />
                <span className="text-sm text-muted-foreground">
                  {backgroundProcessingCount} file{backgroundProcessingCount === 1 ? "" : "s"} processing in the background — you can continue using the app.
                </span>
              </div>
            )}

            {hasFiles && !hasPlan && (
              <div className="glass-card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between animate-in-up">
                <p className="text-sm text-muted-foreground">
                  {tasksLoading ? (
                    <InlineLoadingState label="Checking your plan status..." />
                  ) : (
                    "Files uploaded — head to Plan to generate your personalised study schedule."
                  )}
                </p>
                <Link
                  href="/today/plan"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Go to Plan
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={file.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-in-up">
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
