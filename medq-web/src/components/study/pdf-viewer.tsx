"use client";

import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFViewerProps {
  /** URL that serves the PDF (e.g. /api/section-pdf?...) */
  url: string;
  className?: string;
}

/**
 * Professional in-app PDF viewer using the browser's native renderer
 * inside an iframe. Works reliably across all browsers without
 * external dependencies like pdf.js workers.
 */
export function PDFViewer({ url, className = "" }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handleLoad() {
    setLoading(false);
  }

  function handleError() {
    setLoading(false);
    setError(true);
  }

  // Timeout: if iframe hasn't loaded after 15s, show error
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError(true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading]);

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
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm font-medium">Unable to load PDF</p>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
          The PDF could not be displayed inline. Try opening it in a new tab.
        </p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={openInNewTab}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open in new tab
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
          Source PDF — use built-in controls to navigate and zoom
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={openInNewTab}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
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

      {/* PDF iframe */}
      <div className={`relative ${isFullscreen ? "flex-1" : "h-[70vh]"}`}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Loading source PDF...</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={url}
          onLoad={handleLoad}
          onError={handleError}
          title="Section PDF"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
