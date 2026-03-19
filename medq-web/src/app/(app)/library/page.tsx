"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFiles } from "@/lib/hooks/useFiles";
import { useTasks } from "@/lib/hooks/useTasks";
import { useCourseStore } from "@/lib/stores/course-store";
import { FileUploadZone } from "@/components/library/file-upload-zone";
import { FileCard } from "@/components/library/file-card";
import { InlineLoadingState, ListLoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { IngestionStepper } from "@/components/ui/ingestion-stepper";
import { Upload, ArrowRight, Search, Filter } from "lucide-react";

type StatusFilter = "all" | "processing" | "ready" | "error";
type SortBy = "date" | "name" | "size";

export default function LibraryPage() {
  const courseId = useCourseStore((s) => s.activeCourseId);
  const { files, loading } = useFiles(courseId);
  const { tasks, loading: tasksLoading } = useTasks(courseId);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  const hasFiles = files.length > 0;
  const hasPlan = tasks.length > 0;
  const backgroundProcessingCount = files.filter(
    (file) => file.status === "UPLOADED" || file.status === "PROCESSING"
  ).length;

  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.originalName.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter === "processing") {
      result = result.filter((f) => f.status === "UPLOADED" || f.status === "PROCESSING");
    } else if (statusFilter === "ready") {
      result = result.filter((f) => ["READY", "READY_FULL", "READY_PARTIAL", "ANALYZED"].includes(f.status));
    } else if (statusFilter === "error") {
      result = result.filter((f) => f.status === "FAILED");
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.originalName.localeCompare(b.originalName));
    } else if (sortBy === "size") {
      result.sort((a, b) => b.sizeBytes - a.sizeBytes);
    }
    // "date" is default (already sorted by upload date)

    return result;
  }, [files, searchQuery, statusFilter, sortBy]);

  const filterButtons: { label: string; value: StatusFilter; count: number }[] = [
    { label: "All", value: "all", count: files.length },
    { label: "Processing", value: "processing", count: files.filter((f) => f.status === "UPLOADED" || f.status === "PROCESSING").length },
    { label: "Ready", value: "ready", count: files.filter((f) => ["READY", "READY_FULL", "READY_PARTIAL", "ANALYZED"].includes(f.status)).length },
    { label: "Error", value: "error", count: files.filter((f) => f.status === "FAILED").length },
  ];

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

      {/* Search and filter bar */}
      {hasFiles && (
        <div className="space-y-3 animate-in-up stagger-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              aria-label="Sort files"
            >
              <option value="date">Newest first</option>
              <option value="name">By name</option>
              <option value="size">By size</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={statusFilter === btn.value ? "default" : "outline"}
                size="xs"
                onClick={() => setStatusFilter(btn.value)}
                className="gap-1"
              >
                {btn.label}
                {btn.count > 0 && (
                  <span className={statusFilter === btn.value ? "opacity-70" : "text-muted-foreground"}>
                    {btn.count}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      <div className="space-y-3">
        {loading ? (
          <ListLoadingState
            rows={4}
            label="Loading your files and processing states..."
          />
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 mb-3">
              <Upload className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold">No materials uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Drag a PDF, DOCX, or PPTX above to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Show ingestion stepper for each processing file */}
            {files.filter((f) => ["UPLOADED", "QUEUED", "PARSING", "CHUNKING", "INDEXING", "GENERATING", "PROCESSING"].includes(f.status)).map((file) => {
              const statusMap: Record<string, string> = {
                UPLOADED: "queued", QUEUED: "queued", PARSING: "parsing",
                CHUNKING: "chunking", INDEXING: "indexing",
                GENERATING: "generating_questions", PROCESSING: "chunking",
              };
              const progressMap: Record<string, number> = {
                UPLOADED: 5, QUEUED: 10, PARSING: 25, CHUNKING: 45,
                INDEXING: 60, GENERATING: 80, PROCESSING: 45,
              };
              const stepLabelMap: Record<string, string> = {
                UPLOADED: `Queued — ${file.originalName}`,
                QUEUED: `Queued — ${file.originalName}`,
                PARSING: `Reading ${file.originalName}...`,
                CHUNKING: `Structuring ${file.originalName}...`,
                INDEXING: `Analyzing ${file.originalName}...`,
                GENERATING: `Generating questions for ${file.originalName}...`,
                PROCESSING: `Analyzing ${file.originalName}...`,
              };
              return (
                <IngestionStepper
                  key={file.id}
                  status={statusMap[file.status] ?? "queued"}
                  progress={progressMap[file.status] ?? 10}
                  stepLabel={stepLabelMap[file.status] ?? `Processing ${file.originalName}...`}
                />
              );
            })}

            {hasFiles && !hasPlan && backgroundProcessingCount === 0 && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {tasksLoading ? (
                    <InlineLoadingState
                      label="Checking your plan status..."
                      hint="This usually takes under 10 seconds."
                    />
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
              {filteredFiles.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No files match your search.
                </p>
              ) : (
                filteredFiles.map((file) => (
                  <div key={file.id}>
                    <FileCard file={file} />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
