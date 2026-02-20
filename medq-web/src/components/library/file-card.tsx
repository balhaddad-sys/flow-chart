"use client";

import Link from "next/link";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FileModel } from "@/lib/types/file";

interface FileCardProps {
  file: FileModel;
}

const statusConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  UPLOADED: { icon: Loader2, color: "text-blue-500", label: "Queued" },
  PROCESSING: { icon: Loader2, color: "text-orange-500", label: "Analysing" },
  READY: { icon: CheckCircle2, color: "text-green-500", label: "Ready" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

const phaseLabels: Record<string, string> = {
  EXTRACTING: "Reading your file...",
  ANALYZING: "AI is studying the content...",
  GENERATING_QUESTIONS: "Generating questions...",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSubtitle(file: FileModel): string | null {
  if (file.status === "UPLOADED") return "Starting soon...";
  if (file.status === "PROCESSING") {
    return phaseLabels[file.processingPhase ?? ""] ?? "Hang tight, almost there...";
  }
  return null;
}

export function FileCard({ file }: FileCardProps) {
  const config = statusConfig[file.status] ?? statusConfig.UPLOADED;
  const StatusIcon = config.icon;
  const isAnimated = file.status === "UPLOADED" || file.status === "PROCESSING";
  const subtitle = getSubtitle(file);

  return (
    <Link href={`/library/${file.id}`}>
      <Card className="transition-all hover:bg-accent/40 hover:shadow-sm">
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
