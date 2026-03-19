"use client";

import Link from "next/link";
import { FileText, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FileModel } from "@/lib/types/file";

interface FileCardProps {
  file: FileModel;
}

const statusConfig: Record<string, { icon: typeof FileText; color: string; label: string; textLabel: string }> = {
  UPLOADED: { icon: Clock, color: "text-blue-500", label: "Waiting", textLabel: "Uploaded — waiting for analysis" },
  QUEUED: { icon: Clock, color: "text-blue-500", label: "Queued", textLabel: "Queued — processing will begin shortly" },
  PARSING: { icon: Loader2, color: "text-orange-500", label: "Reading", textLabel: "Being analyzed by AI..." },
  CHUNKING: { icon: Loader2, color: "text-orange-500", label: "Analyzing", textLabel: "Being analyzed by AI..." },
  INDEXING: { icon: Loader2, color: "text-orange-500", label: "Indexing", textLabel: "Being analyzed by AI..." },
  GENERATING: { icon: Loader2, color: "text-orange-500", label: "Generating", textLabel: "Generating questions..." },
  PROCESSING: { icon: Loader2, color: "text-orange-500", label: "Analyzing", textLabel: "Being analyzed by AI..." },
  READY: { icon: CheckCircle2, color: "text-green-500", label: "Ready", textLabel: "Ready to study" },
  READY_PARTIAL: { icon: CheckCircle2, color: "text-green-500", label: "Ready", textLabel: "Ready to study" },
  READY_FULL: { icon: CheckCircle2, color: "text-green-500", label: "Ready", textLabel: "Ready to study" },
  ANALYZED: { icon: CheckCircle2, color: "text-green-500", label: "Ready", textLabel: "Ready to study" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed", textLabel: "Analysis failed — tap to retry" },
};

const phaseLabels: Record<string, string> = {
  EXTRACTING: "Step 1/3: Reading your file...",
  ANALYZING: "Step 2/3: AI is studying the content...",
  GENERATING_QUESTIONS: "Step 3/3: Generating questions...",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSubtitle(file: FileModel): string | null {
  if (file.status === "UPLOADED") return "Queued — processing will begin shortly.";
  if (file.status === "PROCESSING") {
    return phaseLabels[file.processingPhase ?? ""] ?? "Processing in background — this is normal.";
  }
  return null;
}

export function FileCard({ file }: FileCardProps) {
  const config = statusConfig[file.status] ?? statusConfig.UPLOADED;
  const StatusIcon = config.icon;
    const isProcessing = ["UPLOADED", "QUEUED", "PARSING", "CHUNKING", "INDEXING", "GENERATING", "PROCESSING"].includes(file.status);
  const isAnimated = isProcessing;
  const subtitle = getSubtitle(file);
  const isPartial = file.status === "READY_PARTIAL";

  return (
    <Link href={`/library/${file.id}`}>
      <Card className="transition-all hover:bg-accent/40 hover:shadow-sm overflow-hidden">
        {/* Thin progress bar for processing files */}
        {isProcessing && (
          <div className="h-0.5 w-full bg-muted/40">
            <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: "60%" }} />
          </div>
        )}
        <CardContent className="flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <FileText className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{file.originalName}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatBytes(file.sizeBytes)}</span>
              {file.sectionCount > 0 && (
                <>
                  <span>&middot;</span>
                  <span>
                    {file.sectionCount} {file.sectionCount === 1 ? "section" : "sections"}
                  </span>
                </>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
            {isPartial && (
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                Some sections need question retry
              </p>
            )}
          </div>
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            <StatusIcon className={`h-3 w-3 ${isAnimated ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
