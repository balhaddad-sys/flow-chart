"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Confetti } from "@/components/ui/confetti";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  Library,
  MessageSquare,
  Presentation,
  Sparkles,
  Target,
  X,
} from "lucide-react";

const TOTAL_STEPS = 6;
const WALKTHROUGH_KEY = "medq_walkthrough_complete";

/* ── Step 0: Welcome ─────────────────────────────────────────────── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 animate-in-scale animate-glow-pulse">
        <GraduationCap className="h-12 w-12 text-primary" />
      </div>
      <div className="space-y-2 animate-in-up stagger-1">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to MedQ</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Your AI-powered study companion for medical exams. Let&apos;s show you how it works.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="animate-in-up stagger-2 gap-2">
        Let&apos;s Go
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Step 1: Upload Materials ────────────────────────────────────── */
const MOCK_FILES = [
  { name: "Cardiology Notes.pdf", icon: FileText, color: "text-red-500" },
  { name: "Anatomy Slides.pptx", icon: Presentation, color: "text-orange-500" },
  { name: "Pharmacology.docx", icon: FileText, color: "text-blue-500" },
];

function StepUpload({ onNext }: { onNext: () => void }) {
  const [processed, setProcessed] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState<number | null>(null);

  const handleTap = useCallback((idx: number) => {
    if (processed.has(idx) || processing !== null) return;
    setProcessing(idx);
    setTimeout(() => {
      setProcessed((prev) => {
        const next = new Set(prev).add(idx);
        if (next.size === MOCK_FILES.length) setTimeout(onNext, 900);
        return next;
      });
      setProcessing(null);
    }, 1200);
  }, [processed, processing, onNext]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 w-full max-w-sm">
      <div className="space-y-1 text-center animate-in-up">
        <h2 className="text-xl font-bold tracking-tight">Upload Materials</h2>
        <p className="text-muted-foreground text-sm">
          Tap each file to see MedQ process it.
        </p>
      </div>
      <div className="w-full space-y-2.5">
        {MOCK_FILES.map((file, idx) => {
          const isDone = processed.has(idx);
          const isProcessing = processing === idx;
          return (
            <button
              key={file.name}
              type="button"
              onClick={() => handleTap(idx)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3.5 transition-all text-left",
                isDone
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : isProcessing
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-accent/50 cursor-pointer",
                `animate-in-up stagger-${idx + 1}`
              )}
            >
              <div className={cn("shrink-0", file.color)}>
                <file.icon className="h-5 w-5" />
              </div>
              <span className="flex-1 text-sm font-medium truncate">{file.name}</span>
              {isProcessing && (
                <div className="h-5 w-16 rounded-md bg-muted animate-shimmer" />
              )}
              {isDone && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white animate-in-scale">
                  <Check className="h-3 w-3" />
                </div>
              )}
              {!isDone && !isProcessing && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
      {processed.size === MOCK_FILES.length && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in-up">
          All files processed! Sections are ready for study.
        </p>
      )}
    </div>
  );
}

/* ── Step 2: Study Plan ──────────────────────────────────────────── */
const MOCK_TASKS = [
  "Review Cardiology Ch. 3",
  "Practice Anatomy Quiz",
  "Read Pharmacology Notes",
  "Explore Neurology Topic",
];

function StepPlan({ onNext }: { onNext: () => void }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  function toggleTask(idx: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      if (next.size === MOCK_TASKS.length) setTimeout(onNext, 800);
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center gap-5 px-6 w-full max-w-sm">
      <div className="space-y-1 text-center animate-in-up">
        <h2 className="text-xl font-bold tracking-tight">Your Study Plan</h2>
        <p className="text-muted-foreground text-sm">
          Tap tasks to complete them. Stay on track daily.
        </p>
      </div>
      <div className="w-full space-y-1 animate-in-up stagger-1">
        <Progress value={(completed.size / MOCK_TASKS.length) * 100} className="h-1.5 mb-3" />
        {MOCK_TASKS.map((task, idx) => {
          const done = completed.has(idx);
          return (
            <button
              key={task}
              type="button"
              onClick={() => toggleTask(idx)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                done
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border hover:bg-accent/50 cursor-pointer"
              )}
            >
              <div className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                done ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/30"
              )}>
                {done && <Check className="h-3 w-3 animate-in-scale" />}
              </div>
              <span className={cn(
                "text-sm transition-all",
                done && "line-through text-muted-foreground"
              )}>
                {task}
              </span>
            </button>
          );
        })}
      </div>
      {completed.size === MOCK_TASKS.length && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in-up">
          All done for today!
        </p>
      )}
    </div>
  );
}

/* ── Step 3: Practice Quiz ───────────────────────────────────────── */
const MOCK_QUESTION = {
  stem: "Which vessel most commonly supplies the SA node?",
  options: [
    "Left circumflex artery",
    "Right coronary artery",
    "Left anterior descending",
    "Posterior descending artery",
  ],
  correctIndex: 1,
};

function StepQuiz({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number | null>(null);

  function handleSelect(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    if (idx !== MOCK_QUESTION.correctIndex) {
      setShaking(idx);
      setTimeout(() => setShaking(null), 500);
    }
    setTimeout(onNext, 1500);
  }

  function getOptionStyle(idx: number) {
    if (selected === null) return "border-border hover:border-primary/30 hover:bg-accent/50 cursor-pointer";
    if (idx === MOCK_QUESTION.correctIndex) return "border-emerald-500 bg-emerald-500/10";
    if (idx === selected) return "border-destructive bg-destructive/10";
    return "border-border opacity-50";
  }

  return (
    <div className="flex flex-col items-center gap-5 px-6 w-full max-w-sm">
      <div className="space-y-1 text-center animate-in-up">
        <h2 className="text-xl font-bold tracking-tight">Practice Quizzes</h2>
        <p className="text-muted-foreground text-sm">
          Test yourself with AI-generated questions.
        </p>
      </div>
      <div className="w-full rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-1">
        <p className="text-sm font-medium mb-3">{MOCK_QUESTION.stem}</p>
        <div className="space-y-2">
          {MOCK_QUESTION.options.map((opt, idx) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(idx)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                getOptionStyle(idx),
                shaking === idx && "animate-shake"
              )}
            >
              <div className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                selected !== null && idx === MOCK_QUESTION.correctIndex
                  ? "bg-emerald-500 text-white"
                  : selected === idx && idx !== MOCK_QUESTION.correctIndex
                    ? "bg-destructive text-white"
                    : "bg-muted text-muted-foreground"
              )}>
                {selected !== null && idx === MOCK_QUESTION.correctIndex ? (
                  <Check className="h-3 w-3 animate-in-scale" />
                ) : selected === idx && idx !== MOCK_QUESTION.correctIndex ? (
                  <X className="h-3 w-3" />
                ) : (
                  String.fromCharCode(65 + idx)
                )}
              </div>
              <span>{opt}</span>
            </button>
          ))}
        </div>
        {selected !== null && (
          <div className={cn(
            "mt-3 rounded-lg px-3 py-2 text-xs animate-in-up",
            selected === MOCK_QUESTION.correctIndex
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          )}>
            {selected === MOCK_QUESTION.correctIndex
              ? "Correct! The right coronary artery supplies the SA node in ~60% of patients."
              : "Not quite. The RCA supplies the SA node in most patients (~60%)."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 4: Explore & AI ────────────────────────────────────────── */
function StepExplore({ onNext }: { onNext: () => void }) {
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowResponse(true), 1800);
    const autoAdvance = setTimeout(onNext, 4500);
    return () => { clearTimeout(timer); clearTimeout(autoAdvance); };
  }, [onNext]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 w-full max-w-sm">
      <div className="space-y-1 text-center animate-in-up">
        <h2 className="text-xl font-bold tracking-tight">Explore & AI</h2>
        <p className="text-muted-foreground text-sm">
          Learn deeply, then ask follow-up questions.
        </p>
      </div>

      {/* Mock teaching card */}
      <div className="w-full rounded-xl border border-border bg-card p-4 shadow-sm animate-in-up stagger-1">
        <div className="flex items-center gap-2 mb-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Cardiac Conduction System</span>
        </div>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-1.5">
            <Sparkles className="h-3 w-3 mt-0.5 text-primary shrink-0" />
            SA node sets heart rate at 60-100 bpm
          </li>
          <li className="flex items-start gap-1.5">
            <Sparkles className="h-3 w-3 mt-0.5 text-primary shrink-0" />
            AV node delays signal to allow atrial contraction
          </li>
        </ul>
      </div>

      {/* Mock AI chat */}
      <div className="w-full space-y-2 animate-in-up stagger-2">
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-3 w-3 text-primary" />
          </div>
          <div className="rounded-xl rounded-tl-sm border border-border bg-muted/50 px-3 py-2 text-xs">
            What happens when the AV node fails?
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          {!showResponse ? (
            <div className="rounded-xl rounded-tl-sm border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-float" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-float" style={{ animationDelay: "200ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-float" style={{ animationDelay: "400ms" }} />
            </div>
          ) : (
            <div className="rounded-xl rounded-tl-sm border border-primary/20 bg-primary/5 px-3 py-2 text-xs animate-in-up">
              When the AV node fails, the His bundle or Purkinje fibers take over as escape pacemakers at 20-40 bpm. This is called a <span className="font-semibold">junctional or ventricular escape rhythm</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 5: You're Ready! ───────────────────────────────────────── */
function StepReady() {
  useEffect(() => {
    try {
      window.localStorage.setItem(WALKTHROUGH_KEY, "true");
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center px-6">
      <Confetti trigger={true} intensity="high" />
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 animate-in-scale">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div className="space-y-2 animate-in-up stagger-1">
        <h2 className="text-2xl font-bold tracking-tight">You&apos;re All Set!</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Upload your materials, follow your plan, and let MedQ guide your exam prep.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center animate-in-up stagger-2">
        <Link href="/today">
          <Button size="lg" className="gap-2">
            <Target className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </Link>
        <Link href="/library">
          <Button size="lg" variant="outline" className="gap-2">
            <Library className="h-4 w-4" />
            Open Library
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ── Main Walkthrough Page ───────────────────────────────────────── */
export default function GuidePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && step < TOTAL_STEPS - 1) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step]);

  function handleSkip() {
    try { window.localStorage.setItem(WALKTHROUGH_KEY, "true"); } catch { /* ignore */ }
    router.push("/today");
  }

  const canGoBack = step > 0;
  const canGoNext = step < TOTAL_STEPS - 1;
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-xs text-muted-foreground font-medium">
          {step + 1} / {TOTAL_STEPS}
        </span>
        {!isLastStep && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        )}
      </header>

      {/* Progress bar */}
      <div className="px-4 shrink-0">
        <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1" />
      </div>

      {/* Step content */}
      <main className="flex-1 flex items-center justify-center overflow-y-auto py-8" key={step}>
        {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
        {step === 1 && <StepUpload onNext={() => setStep(2)} />}
        {step === 2 && <StepPlan onNext={() => setStep(3)} />}
        {step === 3 && <StepQuiz onNext={() => setStep(4)} />}
        {step === 4 && <StepExplore onNext={() => setStep(5)} />}
        {step === 5 && <StepReady />}
      </main>

      {/* Bottom navigation */}
      <footer className="shrink-0 px-4 pb-6 pt-3">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        {step > 0 && !isLastStep && (
          <div className="flex gap-3 justify-center">
            {canGoBack && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {canGoNext && (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1.5">
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
