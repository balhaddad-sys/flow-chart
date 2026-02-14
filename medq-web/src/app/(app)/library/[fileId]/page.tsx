"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSectionsByFile } from "@/lib/hooks/useSections";
import { useFiles } from "@/lib/hooks/useFiles";
import { useCourseStore } from "@/lib/stores/course-store";
import { SectionList } from "@/components/library/section-list";
import { useAuth } from "@/lib/hooks/useAuth";
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

  const file = files.find((f) => f.id === fileId);
  const hasFailedSections = sections.some((s) => s.aiStatus === "FAILED");

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
    if (!confirm("Delete this file and all its sections and questions?")) return;
    try {
      const result = await fn.deleteFile({ fileId: file.id });
      toast.success(`File deleted (${result.deletedSections} sections, ${result.deletedQuestions} questions removed).`);
      router.replace("/library");
    } catch {
      toast.error("Failed to delete file.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="truncate text-xl font-bold">
              {file?.originalName ?? "Loading..."}
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
        <div className="flex items-center gap-1">
          {hasFailedSections && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`mr-1 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying..." : "Retry Failed"}
            </Button>
          )}
          {file && (
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Sections</h2>
        <SectionList sections={sections} loading={loading} />
      </div>
    </div>
  );
}
