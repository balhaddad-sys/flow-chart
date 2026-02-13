"use client";

import { useFiles } from "@/lib/hooks/useFiles";
import { useCourseStore } from "@/lib/stores/course-store";
import { FileUploadZone } from "@/components/library/file-upload-zone";
import { FileCard } from "@/components/library/file-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files, loading } = useFiles(courseId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Library</h1>
        <p className="mt-1 text-muted-foreground">
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
          <p className="py-12 text-center text-sm text-muted-foreground">
            No files uploaded yet. Upload your first study material above.
          </p>
        ) : (
          files.map((file) => <FileCard key={file.id} file={file} />)
        )}
      </div>
    </div>
  );
}
