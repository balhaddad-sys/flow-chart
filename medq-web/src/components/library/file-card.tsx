"use client";

import Link from "next/link";
import {
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import type { FileModel } from "@/lib/types/file";

interface FileCardProps {
  file: FileModel;
}

interface StatusMeta {
  icon: typeof FileText;
  color: string;
  bg: string;
  label: string;
  animate?: boolean;
}

const STATUS_META: Record<string, StatusMeta> = {
  UPLOADED:       { icon: Clock,        color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",   label: "Queued" },
  QUEUED:         { icon: Clock,        color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-500/10",   label: "Queued" },
  PARSING:        { icon: Loader2,      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10",  label: "Reading", animate: true },
  CHUNKING:       { icon: Loader2,      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10",  label: "Structuring", animate: true },
  INDEXING:       { icon: Loader2,      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10",  label: "Analyzing", animate: true },
  GENERATING:     { icon: HelpCircle,   color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", label: "Generating Qs", animate: true },
  PROCESSING:     { icon: Loader2,      color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10",  label: "Processing", animate: true },
  READY:          { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Ready" },
  READY_PARTIAL:  { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Ready" },
  READY_FULL:     { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Ready" },
  ANALYZED:       { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Ready" },
  FAILED:         { icon: AlertTriangle, color: "text-red-600 dark:text-red-400",    bg: "bg-red-500/10",    label: "Failed" },
};

const PROCESSING_PROGRESS: Record<string, number> = {
  UPLOADED: 5, QUEUED: 8, PARSING: 25, CHUNKING: 45,
  INDEXING: 60, GENERATING: 80, PROCESSING: 50,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function processingHint(status: string): string {
  switch (status) {
    case "UPLOADED":
    case "QUEUED":
      return "Waiting in queue...";
    case "PARSING":
      return "Reading your document...";
    case "CHUNKING":
      return "Splitting into study sections...";
    case "INDEXING":
      return "AI is analyzing content...";
    case "GENERATING":
      return "Generating exam questions...";
    case "PROCESSING":
      return "AI is working on your file...";
    default:
      return "";
  }
}

export function FileCard({ file }: FileCardProps) {
  const meta = STATUS_META[file.status] ?? STATUS_META.UPLOADED;
  const StatusIcon = meta.icon;
  const isProcessing = !!PROCESSING_PROGRESS[file.status];
  const progress = PROCESSING_PROGRESS[file.status] ?? 0;
  const hint = processingHint(file.status);
  const isFailed = file.status === "FAILED";
  const isReady = ["READY", "READY_PARTIAL", "READY_FULL", "ANALYZED"].includes(file.status);

  return (
    <Link href={`/library/${file.id}`} className="block group">
      <div className={`relative rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 ${
        isProcessing ? "border-amber-200 dark:border-amber-500/20" :
        isFailed ? "border-red-200 dark:border-red-500/20" :
        "border-border"
      }`}>
        {/* Progress bar for processing files */}
        {isProcessing && (
          <div className="h-1 w-full bg-muted/30">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-400 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-3.5 px-4 py-3.5">
          {/* File icon with status indicator */}
          <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
            <FileText className={`h-5 w-5 ${meta.color}`} />
            <div className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card border-2 border-card">
              <StatusIcon className={`h-3 w-3 ${meta.color} ${meta.animate ? "animate-spin" : ""}`} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
              {file.originalName}
            </p>

            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatBytes(file.sizeBytes)}</span>
              {file.sectionCount > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <BookOpen className="h-3 w-3" />
                    {file.sectionCount} {file.sectionCount === 1 ? "section" : "sections"}
                  </span>
                </>
              )}
            </div>

            {/* Processing hint */}
            {isProcessing && hint && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                {hint}
              </p>
            )}

            {/* Failed hint */}
            {isFailed && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Analysis failed — tap to view details and retry
              </p>
            )}

            {/* Partial ready hint */}
            {file.status === "READY_PARTIAL" && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Some sections need question retry
              </p>
            )}
          </div>

          {/* Right side: status chip + chevron */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.color}`}>
              {isReady && <CheckCircle2 className="h-3 w-3" />}
              {meta.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </div>
        </div>
      </div>
    </Link>
  );
}
