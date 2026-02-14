"use client";

import Link from "next/link";
import { useFiles } from "@/lib/hooks/useFiles";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { FileUploadZone } from "@/components/library/file-upload-zone";
import { FileCard } from "@/components/library/file-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files, loading } = useFiles(courseId);
  const { tasks } = useTasks(courseId);
  const hasFiles = files.length > 0;
  const hasPlan = tasks.length > 0;

  return (
    <div className="page-wrap page-stack">
      <div className="glass-card p-5 sm:p-6">
        <h1 className="page-title">Library</h1>
        <p className="page-subtitle">
          Upload and manage your study materials.
        </p>
      </div>

      <FileUploadZone />

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : files.length === 0 ? (
          <div className="glass-card px-6 py-12 text-center text-sm text-muted-foreground">
            No files uploaded yet. Upload your first study material above.
          </div>
        ) : (
          <>
            {hasFiles && !hasPlan && (
              <div className="glass-card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Files uploaded. Head to Plan to generate your schedule.</span>
                <Link href="/planner" className="font-medium text-primary hover:underline">
                  Go to Plan
                </Link>
              </div>
            )}
            {files.map((file) => <FileCard key={file.id} file={file} />)}
          </>
        )}
      </div>
    </div>
  );
}
