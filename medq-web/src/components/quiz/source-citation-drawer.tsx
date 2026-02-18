"use client";

import { useState } from "react";
import { BookOpen, X, FileText, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionSourceCitation, QuestionCitation, QuestionSourceRef } from "@/lib/types/question";

interface SourceCitationDrawerProps {
  sourceCitations?: QuestionSourceCitation[];
  citations?: QuestionCitation[];
  sourceRef?: QuestionSourceRef;
}

export function SourceCitationDrawer({
  sourceCitations,
  citations,
  sourceRef,
}: SourceCitationDrawerProps) {
  const [open, setOpen] = useState(false);

  const hasChunkCitations = sourceCitations && sourceCitations.length > 0;
  const hasUrlCitations = citations && citations.length > 0;
  const hasSource = sourceRef && (sourceRef.label || sourceRef.fileName);

  if (!hasChunkCitations && !hasUrlCitations && !hasSource) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="View source material"
      >
        <BookOpen className="h-3.5 w-3.5" />
        View Source
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel */}
          <div className="relative z-50 w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-border/70 bg-card shadow-2xl animate-in-up overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Source Material</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Chunk-level citations from uploaded file */}
              {hasChunkCitations && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    From your study material
                  </p>
                  {sourceCitations!.map((cite, i) => (
                    <div
                      key={`${cite.chunkId}_${i}`}
                      className="rounded-xl border border-border/60 bg-background/70 p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {cite.pageNumber != null
                            ? `Page ${cite.pageNumber}`
                            : cite.slideIndex != null
                            ? `Slide ${cite.slideIndex}`
                            : "Document excerpt"}
                        </span>
                      </div>
                      <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/90 italic">
                        &ldquo;{cite.quote}&rdquo;
                      </blockquote>
                    </div>
                  ))}
                </div>
              )}

              {/* Source reference */}
              {hasSource && !hasChunkCitations && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Derived from
                  </p>
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="text-sm font-medium">
                      {sourceRef!.fileName || sourceRef!.label}
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    Upload more material to enable precise page-level source citations.
                  </p>
                </div>
              )}

              {/* URL citations */}
              {hasUrlCitations && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Clinical references
                  </p>
                  <div className="space-y-2">
                    {citations!.map((cite, i) => (
                      <a
                        key={`${cite.url}_${i}`}
                        href={cite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary text-xs">{cite.source}</p>
                          <p className="text-foreground/85 mt-0.5 text-xs leading-relaxed">
                            {cite.title}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback */}
              {!hasChunkCitations && !hasSource && !hasUrlCitations && (
                <div className="text-center py-6 space-y-2">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No source citations available for this question.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
