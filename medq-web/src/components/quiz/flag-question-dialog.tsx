"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Flag, CheckCircle2, Loader2 } from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import type { FlagReason } from "@/lib/firebase/functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FLAG_OPTIONS: { value: FlagReason; label: string; description: string }[] = [
  { value: "incorrect",       label: "Incorrect answer",    description: "The marked correct answer appears wrong" },
  { value: "ambiguous",       label: "Ambiguous question",  description: "Multiple answers could be correct" },
  { value: "bad_explanation", label: "Poor explanation",    description: "The explanation is unclear or misleading" },
  { value: "source_mismatch", label: "Source mismatch",     description: "Content doesn't match my study material" },
  { value: "duplicate",       label: "Duplicate",           description: "Very similar to another question" },
  { value: "other",           label: "Other issue",         description: "Something else needs review" },
];

interface FlagQuestionDialogProps {
  questionId: string;
  trigger?: React.ReactNode;
}

export function FlagQuestionDialog({ questionId, trigger }: FlagQuestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FlagReason | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await fn.flagQuestion({
        questionId,
        reason: selected,
        freeText: freeText.trim() || undefined,
      });
      setSubmitted(true);
      toast.success("Reported — thank you for helping improve quality.");
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setSelected(null);
        setFreeText("");
      }, 1500);
    } catch {
      toast.error("Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          aria-label="Flag this question"
        >
          {trigger ?? (
            <>
              <Flag className="h-3.5 w-3.5" />
              Report
            </>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm rounded-2xl border-border/70 p-0" showCloseButton={!submitted}>
        {submitted ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8" role="status">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-medium">Thank you!</p>
            <p className="text-xs text-center text-muted-foreground">
              Your report helps us improve question quality.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border/50 px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 text-amber-500" />
                Report an Issue
              </DialogTitle>
            </DialogHeader>

            <div className="p-5 space-y-4">
              {/* Reason options */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  What&apos;s wrong?
                </p>
                <div className="space-y-1.5">
                  {FLAG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelected(opt.value)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                        selected === opt.value
                          ? "border-primary/50 bg-primary/8"
                          : "border-border/60 hover:border-primary/25 hover:bg-accent/40"
                      )}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional note */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Additional note <span className="normal-case font-normal">(optional)</span>
                </p>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
                  placeholder="Add any extra detail…"
                  rows={2}
                  className="w-full rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                />
              </div>

              <Button
                className="w-full rounded-xl"
                onClick={handleSubmit}
                disabled={!selected || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
