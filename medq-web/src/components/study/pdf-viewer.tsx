"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { getAuth } from "firebase/auth";

interface PDFViewerProps {
  /** Firebase Storage path (e.g. "users/uid/files/abc.pdf") */
  storagePath: string;
  /** 1-based start page */
  startPage: number;
  /** 1-based end page */
  endPage: number;
  className?: string;
}

/**
 * Client-side PDF viewer that extracts a page range from the source PDF.
 * Downloads via server-side proxy to avoid CORS, then uses pdf-lib
 * in the browser to extract the relevant pages.
 */
export function PDFViewer({ storagePath, startPage, endPage, className = "" }: PDFViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const buildSectionPdf = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(10);

    try {
      // 1. Get the Firebase download URL
      setProgress(15);
      const fileRef = ref(storage, storagePath);
      const downloadUrl = await getDownloadURL(fileRef);

      // 2. Fetch via server-side proxy (avoids CORS)
      setProgress(25);
      const authToken = await getAuth().currentUser?.getIdToken();
      if (!authToken) throw new Error("Not authenticated");

      const proxyUrl = `/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`;
      const res = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to download PDF (${res.status})`);
      }
      setProgress(50);

      const arrayBuf = await res.arrayBuffer();
      setProgress(60);

      // 3. Parse and extract pages
      const sourcePdf = await PDFDocument.load(arrayBuf, { ignoreEncryption: true });
      const totalPages = sourcePdf.getPageCount();

      if (totalPages === 0) throw new Error("PDF has no pages");

      const start = Math.max(1, Math.min(startPage, totalPages));
      const end = Math.max(start, Math.min(endPage, totalPages));
      const pageIndexes = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);

      setProgress(75);
      const sectionPdf = await PDFDocument.create();
      const copiedPages = await sectionPdf.copyPages(sourcePdf, pageIndexes);
      copiedPages.forEach((page) => sectionPdf.addPage(page));

      setProgress(90);
      const outputBytes = await sectionPdf.save();
      const outputBlob = new Blob([new Uint8Array(outputBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(outputBlob);

      // Clean up previous blob
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      setBlobUrl(url);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setLoading(false);
    }
  }, [storagePath, startPage, endPage]);

  useEffect(() => {
    buildSectionPdf();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [buildSectionPdf]);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function openInNewTab() {
    if (blobUrl) window.open(blobUrl, "_blank");
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm font-medium">Unable to load PDF</p>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={buildSectionPdf}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col rounded-xl overflow-hidden border border-border/50 ${
        isFullscreen ? "fixed inset-0 z-50 bg-background rounded-none border-none" : ""
      } ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border/50">
        <p className="text-xs font-medium text-muted-foreground">
          Pages {startPage}–{endPage} — use built-in controls to navigate
        </p>
        <div className="flex items-center gap-1">
          {blobUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={openInNewTab}
              aria-label="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF content */}
      <div className={`relative ${isFullscreen ? "flex-1" : "h-[70vh]"}`}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              {progress < 25 ? "Preparing download..." :
               progress < 50 ? "Downloading PDF..." :
               progress < 75 ? "Extracting pages..." :
               "Rendering..."}
            </p>
            <div className="mt-2 h-1 w-32 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {blobUrl && (
          <iframe
            src={blobUrl}
            title="Section PDF"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
          />
        )}
      </div>
    </div>
  );
}
