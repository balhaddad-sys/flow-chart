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
  PROCESSING: { icon: Loader2, color: "text-orange-500", label: "Processing" },
  READY: { icon: CheckCircle2, color: "text-green-500", label: "Ready" },
  FAILED: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({ file }: FileCardProps) {
  const config = statusConfig[file.status] ?? statusConfig.UPLOADED;
  const StatusIcon = config.icon;
  const isAnimated = file.status === "UPLOADED" || file.status === "PROCESSING";

  return (
    <Link href={`/library/${file.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-3 p-4">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
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
          </div>
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            <StatusIcon className={`h-3 w-3 ${isAnimated ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
          {file.processingPhase && file.status === "PROCESSING" && (
            <span className="text-xs text-muted-foreground">{file.processingPhase}</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
