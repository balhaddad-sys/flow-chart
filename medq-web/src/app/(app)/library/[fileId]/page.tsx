"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSectionsByFile } from "@/lib/hooks/useSections";
import { useFiles } from "@/lib/hooks/useFiles";
import { useCourseStore } from "@/lib/stores/course-store";
import { SectionList } from "@/components/library/section-list";
import { useAuth } from "@/lib/hooks/useAuth";
import { InlineLoadingState, LoadingButtonLabel } from "@/components/ui/loading-state";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

export default function FileDetailPage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = use(params);
  const router = useRouter();
  const { uid } = useAuth();
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files } = useFiles(courseId);
  const { sections, loading } = useSectionsByFile(fileId);

  const [retrying, setRetrying] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const file = files.find((f) => f.id === fileId);
  const isFileLoading = !file && loading;
  const hasFailedSections = sections.some((s) => s.aiStatus === "FAILED" || s.questionsStatus === "FAILED");

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await fn.retryFailedSections({ fileId });
      toast.success(`Retrying ${result.retriedCount} section(s). Processing will begin shortly.`);
    } catch {
      toast.error("Failed to retry sections. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    if (!uid || !file) return;
    setDeleting(true);
    try {
      const result = await fn.deleteFile({ fileId: file.id });
      toast.success(`File deleted (${result.deletedSections} sections, ${result.deletedQuestions} questions removed).`);
      router.replace("/library");
    } catch {
      toast.error("Failed to delete file.");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground">Library</Link>
        <span>/</span>
        <span className="truncate text-foreground">
          {file?.originalName ?? (
            <InlineLoadingState
              label="Loading file details..."
              hint="This is normal while we sync your course."
              className="text-xs"
            />
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {file?.originalName ?? "Preparing file details..."}
            </h1>
          </div>
          {file && (
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{file.status}</Badge>
              <span>
                {file.sectionCount} {file.sectionCount === 1 ? "section" : "sections"}
              </span>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {hasFailedSections && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <LoadingButtonLabel label="Retrying..." />
              ) : (
                <>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Retry Failed
                </>
              )}
            </Button>
          )}
          {file && !deleteConfirmOpen && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmOpen(true)} className="text-destructive" aria-label="Delete file">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {deleteConfirmOpen && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Delete this file and all its sections and questions?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">This action cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="rounded-lg">
              {deleting ? <LoadingButtonLabel label="Deleting..." /> : "Delete"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(false)} className="rounded-lg">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sections</h2>
        {isFileLoading && (
          <div className="mb-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
            <InlineLoadingState
              label="Loading sections for this file..."
              hint="If processing is still running, new sections will appear automatically."
            />
          </div>
        )}
        <SectionList sections={sections} loading={loading} />
      </div>
    </div>
  );
}
