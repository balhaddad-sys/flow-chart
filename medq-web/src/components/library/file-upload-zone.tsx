"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadFile, validateFile, type UploadProgress } from "@/lib/firebase/storage";
import { toast } from "sonner";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourseStore } from "@/lib/stores/course-store";

export function FileUploadZone() {
  const { uid } = useAuth();
  const courseId = useCourseStore((s) => s.activeCourseId);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<
    Map<string, { name: string; progress: UploadProgress | null; error?: string }>
  >(new Map());
  const cleanupTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = cleanupTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!uid || !courseId) return;

      const fileArray = Array.from(files);
      const uploadSingleFile = async (file: File) => {
        const error = validateFile(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          setUploads((prev) => {
            const next = new Map(prev);
            next.set(file.name, { name: file.name, progress: null, error });
            return next;
          });
          return;
        }

        setUploads((prev) => {
          const next = new Map(prev);
          next.set(file.name, {
            name: file.name,
            progress: { bytesTransferred: 0, totalBytes: file.size, percent: 0, state: "running" },
          });
          return next;
        });

        try {
          const { uploadTask } = await uploadFile(uid, courseId, file, (progress) => {
            setUploads((prev) => {
              const next = new Map(prev);
              next.set(file.name, { name: file.name, progress });
              return next;
            });
          });

          await uploadTask;

          setUploads((prev) => {
            const next = new Map(prev);
            next.set(file.name, {
              name: file.name,
              progress: { bytesTransferred: file.size, totalBytes: file.size, percent: 100, state: "success" },
            });
            return next;
          });

          toast.success(`${file.name} uploaded! AI analysis will begin shortly.`);
          const timer = setTimeout(() => {
            cleanupTimers.current.delete(timer);
            setUploads((prev) => {
              const next = new Map(prev);
              next.delete(file.name);
              return next;
            });
          }, 3000);
          cleanupTimers.current.add(timer);
        } catch {
          toast.error(`Failed to upload ${file.name}.`);
          setUploads((prev) => {
            const next = new Map(prev);
            next.set(file.name, { name: file.name, progress: null, error: "Upload failed" });
            return next;
          });
        }
      };

      await Promise.all(fileArray.map((file) => uploadSingleFile(file)));
    },
    [uid, courseId]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  if (!courseId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Select a course first to upload files.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
        }`}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop files here</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, PPTX, or DOCX (max 100MB)</p>
        <label className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <span>Browse Files</span>
          </Button>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.pptx,.docx"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
      </div>

      {uploads.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploads.entries()).map(([key, upload]) => (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{upload.name}</p>
                {upload.error ? (
                  <p role="alert" className="text-xs text-destructive">{upload.error}</p>
                ) : upload.progress ? (
                  <Progress value={upload.progress.percent} className="mt-1 h-1" />
                ) : null}
              </div>
              {upload.progress?.state === "running" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {upload.error && (
                <button
                  aria-label={`Dismiss error for ${upload.name}`}
                  onClick={() =>
                    setUploads((prev) => {
                      const next = new Map(prev);
                      next.delete(key);
                      return next;
                    })
                  }
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
