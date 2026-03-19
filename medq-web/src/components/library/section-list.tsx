"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListLoadingState } from "@/components/ui/loading-state";
import { BookOpen, Loader2, CheckCircle2, AlertCircle, HelpCircle, ExternalLink } from "lucide-react";
import type { SectionModel } from "@/lib/types/section";
import type { FileModel } from "@/lib/types/file";
import { getFileDownloadUrl } from "@/lib/firebase/storage";
import { getAuth } from "firebase/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SectionListProps {
  sections: SectionModel[];
  loading: boolean;
  file?: FileModel;
}

const aiStatusConfig: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  PENDING: { icon: Loader2, color: "text-muted-foreground", label: "Pending" },
  PROCESSING: { icon: Loader2, color: "text-orange-500", label: "Analyzing" },
  ANALYZED: { icon: CheckCircle2, color: "text-green-500", label: "Ready" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

export function SectionList({ sections, loading, file }: SectionListProps) {
  const [openingSectionId, setOpeningSectionId] = useState<string | null>(null);

  async function handleOpenSectionSource(section: SectionModel) {
    if (!file?.storagePath) {
      toast.error("Source file is not available yet.");
      return;
    }

    setOpeningSectionId(section.id);
    const startIndex = Math.max(1, Math.floor(section.contentRef.startIndex || 1));
    const endIndex = Math.max(
      startIndex,
      Math.floor(section.contentRef.endIndex || startIndex)
    );
    const isPdf = file.mimeType === "application/pdf";
    // Open blank tab synchronously (must NOT use noopener — it returns null)
    const previewWindow = window.open("", "_blank");

    try {
      const downloadUrl = await getFileDownloadUrl(file.storagePath);
      const authToken = await getAuth().currentUser?.getIdToken() ?? "";
      const sourceUrl = isPdf
        ? `/api/section-pdf?url=${encodeURIComponent(downloadUrl)}&start=${startIndex}&end=${endIndex}&name=${encodeURIComponent(file.originalName)}&token=${encodeURIComponent(authToken)}`
        : downloadUrl;

      if (previewWindow) {
        previewWindow.opener = null; // security: detach opener reference
        previewWindow.location.href = sourceUrl;
      }

      if (!isPdf) {
        toast.message(
          "Opened source file. Direct page jump is currently supported for PDF files."
        );
      }
    } catch {
      previewWindow?.close();
      toast.error("Failed to open source pages. Please try again.");
    } finally {
      setOpeningSectionId(null);
    }
  }

  function getRangeLabel(section: SectionModel): string {
    const { type, startIndex, endIndex } = section.contentRef;
    const start = Math.max(1, Math.floor(startIndex || 1));
    const endRaw = Math.max(start, Math.floor(endIndex || start));
    const end = endRaw >= start ? endRaw : start;

    if (type === "page") return start === end ? `Page ${start}` : `Pages ${start}-${end}`;
    if (type === "slide") return start === end ? `Slide ${start}` : `Slides ${start}-${end}`;
    return start === end ? `Word ${start}` : `Words ${start}-${end}`;
  }

  if (loading) {
    return (
      <ListLoadingState
        rows={4}
        label="Loading sections and AI analysis status..."
      />
    );
  }

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sections yet. Processing may still be running in the background.
      </p>
    );
  }

  const analyzedCount = sections.filter((s) => s.aiStatus === "ANALYZED").length;
  const processingCount = sections.filter((s) => s.aiStatus === "PENDING" || s.aiStatus === "PROCESSING").length;
  const failedCount = sections.filter((s) => s.aiStatus === "FAILED").length;
  const totalQuestions = sections.reduce((sum, s) => sum + (s.questionsCount || 0), 0);

  return (
    <div className="space-y-2">
      {/* Processing summary bar */}
      {(processingCount > 0 || (failedCount > 0 && analyzedCount > 0)) && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-xs">
          {processingCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {processingCount} analyzing
            </span>
          )}
          {analyzedCount > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {analyzedCount} ready
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              {failedCount} failed
            </span>
          )}
          {totalQuestions > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <HelpCircle className="h-3 w-3" />
              {totalQuestions} questions total
            </span>
          )}
        </div>
      )}
      {sections.map((section) => {
        const config = aiStatusConfig[section.aiStatus] ?? aiStatusConfig.PENDING;
        const StatusIcon = config.icon;
        const isAnimated = section.aiStatus === "PENDING" || section.aiStatus === "PROCESSING";
        const isOpening = openingSectionId === section.id;
        const rangeLabel = getRangeLabel(section);

        return (
          <Card
            key={section.id}
            className={cn(
              "transition-colors hover:bg-accent/50",
              file?.storagePath && "cursor-pointer"
            )}
            role={file?.storagePath ? "button" : undefined}
            tabIndex={file?.storagePath ? 0 : undefined}
            onClick={file?.storagePath ? () => void handleOpenSectionSource(section) : undefined}
            onKeyDown={file?.storagePath ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              void handleOpenSectionSource(section);
            } : undefined}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{section.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{section.estMinutes}m</span>
                  <span>&middot;</span>
                  <span>Difficulty {section.difficulty}/5</span>
                  <span>&middot;</span>
                  <span>{rangeLabel}</span>
                  {section.questionsCount > 0 && (
                    <>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5">
                        <HelpCircle className="h-3 w-3" />
                        {section.questionsCount} Qs
                      </span>
                    </>
                  )}
                </div>
                {section.topicTags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {section.topicTags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {file?.storagePath && (
                  isOpening ? (
                    <Badge variant="outline" className="gap-1 text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Opening...
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground hover:text-primary transition-colors">
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">View Source</span>
                    </Badge>
                  )
                )}
                <Badge variant="outline" className={`gap-1 ${config.color}`}>
                  <StatusIcon className={`h-3 w-3 ${isAnimated ? "animate-spin" : ""}`} />
                  {config.label}
                </Badge>
                {section.aiStatus === "ANALYZED" && section.questionsCount > 0 && (
                  <Link
                    href={`/practice/quiz?section=${section.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Quiz
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
