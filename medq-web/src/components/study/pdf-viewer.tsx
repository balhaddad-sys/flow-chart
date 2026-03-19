"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Use the CDN worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  startPage?: number;
  endPage?: number;
  className?: string;
}

export function PDFViewer({ url, startPage = 1, endPage, className = "" }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Clamp page range
  const effectiveStart = Math.max(1, startPage);
  const effectiveEnd = endPage ? Math.min(endPage, numPages || endPage) : numPages;
  const totalSectionPages = effectiveEnd - effectiveStart + 1;
  const sectionPageIndex = currentPage - effectiveStart + 1;

  // Auto-fit width
  const [containerWidth, setContainerWidth] = useState(600);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pageWidth = useMemo(() => {
    const base = Math.min(containerWidth - 32, 800);
    return base * scale;
  }, [containerWidth, scale]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setCurrentPage(effectiveStart);
    setLoading(false);
  }

  function onDocumentLoadError() {
    setError("Failed to load PDF. The file may be too large or unavailable.");
    setLoading(false);
  }

  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(effectiveStart, Math.min(page, effectiveEnd));
    setCurrentPage(clamped);
    pageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [effectiveStart, effectiveEnd]);

  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 3.0)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => setScale(1.0), []);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
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

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prevPage(); }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); nextPage(); }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
      if (e.key === "-") { e.preventDefault(); zoomOut(); }
      if (e.key === "0") { e.preventDefault(); resetZoom(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevPage, nextPage, zoomIn, zoomOut, resetZoom]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm font-medium">Unable to load PDF</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-muted/30 rounded-xl overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50 bg-background rounded-none" : ""
      } ${className}`}
    >
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-background/90 backdrop-blur-sm border-b border-border/50">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={prevPage}
            disabled={currentPage <= effectiveStart}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium tabular-nums min-w-[4.5rem] text-center">
            {loading ? "..." : `${sectionPageIndex} / ${totalSectionPages}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={nextPage}
            disabled={currentPage >= effectiveEnd}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button onClick={resetZoom} className="text-xs font-medium tabular-nums min-w-[2.5rem] text-center hover:text-foreground text-muted-foreground transition-colors">
            {Math.round(scale * 100)}%
          </button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn} disabled={scale >= 3.0} aria-label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-1" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* PDF content */}
      <div className={`flex-1 overflow-auto ${isFullscreen ? "h-[calc(100vh-3rem)]" : "max-h-[70vh]"}`}>
        <div className="flex justify-center py-4 px-4" ref={pageRef}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">Loading PDF...</p>
            </div>
          )}
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="flex justify-center"
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg rounded-lg overflow-hidden"
              loading={
                <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageWidth * 1.4 }}>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            />
          </Document>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-3 py-1.5 text-center border-t border-border/50 bg-background/60">
        <p className="text-[0.65rem] text-muted-foreground">
          Arrow keys to navigate · +/- to zoom · 0 to reset · F11 fullscreen
        </p>
      </div>
    </div>
  );
}
