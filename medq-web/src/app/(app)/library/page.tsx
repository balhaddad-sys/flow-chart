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
      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title animate-in-up stagger-1">Library</h1>
        <p className="page-subtitle animate-in-up stagger-2">
          Upload once and keep studying while processing runs in the background.
        </p>
      </div>

      <div className="animate-in-up stagger-3">
        <FileUploadZone />
      </div>

      <div className="space-y-3">
        {loading ? (
          <ListLoadingState rows={4} />
        ) : files.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center rounded-2xl border-dashed py-16 text-center">
            <Upload className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">No files uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first study material above.
            </p>
          </div>
        ) : (
          <>
            {backgroundProcessingCount > 0 && (
              <div className="glass-card flex items-center gap-3 px-4 py-3 text-sm animate-in-up">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-glow-pulse" />
                <span className="text-muted-foreground">
                  {backgroundProcessingCount} file{backgroundProcessingCount === 1 ? "" : "s"} processing in background. You can keep using the app.
                </span>
              </div>
            )}
            {hasFiles && !hasPlan && (
              <div className="glass-card flex items-center justify-between gap-3 px-4 py-3 text-sm border-primary/15 animate-in-up">
                <span className="text-muted-foreground">
                  {tasksLoading ? (
                    <InlineLoadingState label="Checking your plan status..." />
                  ) : (
                    "Files uploaded. Head to Plan to generate your schedule."
                  )}
                </span>
                <Link href="/today/plan" className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors">
                  Go to Plan
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            {files.map((file, i) => (
              <div key={file.id} style={{ animationDelay: `${i * 50}ms` }} className="animate-in-up">
                <FileCard file={file} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
