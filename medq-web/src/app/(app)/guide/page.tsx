"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircleHelp,
  Lightbulb,
  Library,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ChecklistStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const QUICK_START_STEPS: ChecklistStep[] = [
  {
    id: "upload-materials",
    title: "Upload your study material",
    description:
      "Go to Library and upload your PDF, DOCX, or PPTX. The app extracts sections automatically.",
    href: "/library",
    cta: "Open Library",
  },
  {
    id: "review-plan",
    title: "Review your daily plan",
    description:
      "Open Today Plan and confirm task durations. Keep tasks realistic to stay consistent.",
    href: "/today/plan",
    cta: "Open Plan",
  },
  {
    id: "run-practice",
    title: "Start your first quiz",
    description:
      "Use Practice to test retention. Start with section quizzes, then move to mixed mode.",
    href: "/practice",
    cta: "Open Practice",
  },
  {
    id: "deep-learn",
    title: "Use Explore to learn deeply",
    description:
      "Choose Learn mode for structured teaching or Quiz mode for challenge-style questions.",
    href: "/ai/explore",
    cta: "Open Explore",
  },
  {
    id: "ask-ai",
    title: "Use AI Chat for clarification",
    description:
      "Ask targeted questions when stuck. Keep prompts specific for best answers and citations.",
    href: "/ai",
    cta: "Open AI Chat",
  },
];

const APP_FLOWS = [
  {
    title: "Library -> Structured Content",
    icon: Library,
    href: "/library",
    summary:
      "Upload resources and let MedQ split content into study-ready sections.",
    bullets: [
      "Supports PDF, PPTX, DOCX",
      "Tracks processing state per file",
      "Builds section-level study material",
    ],
  },
  {
    title: "Today -> Daily Execution",
    icon: Target,
    href: "/today",
    summary:
      "Follow a clear daily workflow with tasks, priorities, and progress tracking.",
    bullets: [
      "See what to do now",
      "Track completion and momentum",
      "Adjust plan when schedule changes",
    ],
  },
  {
    title: "Practice -> Retention Testing",
    icon: CircleHelp,
    href: "/practice",
    summary:
      "Use section, mixed, random, and assessment modes to sharpen exam readiness.",
    bullets: [
      "Start easy, then increase difficulty",
      "Review explanations after each answer",
      "Use weak-topic feedback to target revision",
    ],
  },
  {
    title: "Explore + AI -> Deep Understanding",
    icon: BrainCircuit,
    href: "/ai/explore",
    summary:
      "Learn concepts in depth, then ask follow-up questions with context-aware AI.",
    bullets: [
      "Explore Learn mode gives structured notes",
      "Use Dig deeper buttons for section-specific follow-up",
      "Verify citations before clinical use",
    ],
  },
];

const TROUBLESHOOTING = [
  {
    q: "My uploaded file is stuck in processing.",
    a: "Wait a short period, then refresh the page. If it remains stuck, re-upload the file and ensure it is readable, under the size limit, and not image-only scans.",
  },
  {
    q: "I am not seeing generated questions.",
    a: "Open Practice and check section status. If a section says failed or pending, trigger generation again and allow background generation to finish.",
  },
  {
    q: "Explore answers feel too broad.",
    a: "Use specific prompts with topic + section + objective. The new Dig deeper section action in Explore helps you send focused prompts automatically.",
  },
  {
    q: "How do I improve quiz scores quickly?",
    a: "Use weak-topic feedback, do short daily quiz blocks, review explanations immediately, and re-test the same topics after 24-48 hours.",
  },
];

const DAILY_ROUTINE = [
  "10 min: Review today's plan and priorities",
  "20 min: Active study from one section",
  "15 min: Practice quiz on the same section",
  "10 min: Review errors and key takeaways",
  "5 min: Ask AI one targeted follow-up question",
];

const GUIDE_STORAGE_KEY = "medq_guide_progress";

function loadGuideProgress(): { steps: Record<string, boolean>; routine: Record<number, boolean> } {
  try {
    const raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        steps: parsed.steps || {},
        routine: parsed.routine || {},
      };
    }
  } catch { /* ignore */ }
  return { steps: {}, routine: {} };
}

export default function GuidePage() {
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [completedRoutine, setCompletedRoutine] = useState<Record<number, boolean>>({});

  // Load persisted progress on mount
  useEffect(() => {
    const saved = loadGuideProgress();
    setCompletedSteps(saved.steps);
    setCompletedRoutine(saved.routine);
  }, []);

  // Persist whenever checklist state changes
  const persist = useCallback((steps: Record<string, boolean>, routine: Record<number, boolean>) => {
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ steps, routine }));
    } catch { /* ignore */ }
  }, []);

  const quickStartProgress = useMemo(() => {
    const done = QUICK_START_STEPS.filter((step) => completedSteps[step.id]).length;
    return { done, total: QUICK_START_STEPS.length };
  }, [completedSteps]);

  const routineProgress = useMemo(() => {
    const done = DAILY_ROUTINE.filter((_, idx) => completedRoutine[idx]).length;
    return { done, total: DAILY_ROUTINE.length };
  }, [completedRoutine]);

  function toggleStep(stepId: string) {
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      persist(next, completedRoutine);
      return next;
    });
  }

  function toggleRoutine(index: number) {
    setCompletedRoutine((prev) => {
      const next = { ...prev, [index]: !prev[index] };
      persist(completedSteps, next);
      return next;
    });
  }

  return (
    <div className="page-wrap page-stack max-w-5xl">
      <section className="animate-in-up">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="page-title">MedQ App Guide</h1>
        </div>
        <p className="page-subtitle">
          Step-by-step guide to use MedQ efficiently for exam preparation.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in-up stagger-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Quick Start Checklist</p>
            <p className="text-xs text-muted-foreground">
              Complete these steps to set up your workflow in under 10 minutes.
            </p>
          </div>
          <Badge variant="outline">
            {quickStartProgress.done}/{quickStartProgress.total} complete
          </Badge>
        </div>

        <div className="space-y-3">
          {QUICK_START_STEPS.map((step) => {
            const done = Boolean(completedSteps[step.id]);
            return (
              <div
                key={step.id}
                className={`rounded-lg border p-3 transition-colors ${
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/70 bg-background/60"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className={`mt-0.5 rounded-md p-1 transition-colors ${
                      done
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={`Mark ${step.title} complete`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  <Link href={step.href}>
                    <Button size="sm" variant={done ? "outline" : "default"}>
                      {step.cta}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 animate-in-up stagger-2">
        {APP_FLOWS.map((flow) => (
          <Link key={flow.title} href={flow.href}>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:bg-accent/50 hover:border-primary/20 cursor-pointer h-full">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <flow.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">{flow.title}</p>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{flow.summary}</p>
              <ul className="mt-3 space-y-1">
                {flow.bullets.map((bullet) => (
                  <li key={bullet} className="text-xs text-muted-foreground">
                    • {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in-up stagger-3">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold">Daily Study Routine (60 minutes)</p>
          <Badge variant="outline">
            {routineProgress.done}/{routineProgress.total} done
          </Badge>
        </div>
        <div className="space-y-2">
          {DAILY_ROUTINE.map((task, index) => {
            const done = Boolean(completedRoutine[index]);
            return (
              <button
                key={task}
                type="button"
                onClick={() => toggleRoutine(index)}
                className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/70 bg-background/60 hover:bg-accent/40"
                }`}
              >
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-sm">{task}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in-up stagger-4">
        <div className="mb-2 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Troubleshooting & FAQ</p>
        </div>
        <div className="space-y-2">
          {TROUBLESHOOTING.map((item) => (
            <details
              key={item.q}
              className="rounded-lg border border-border/70 bg-background/70 p-3"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {item.q}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 animate-in-up stagger-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold">Clinical Safety Reminder</p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          MedQ is designed for learning and exam prep. Always verify guidance with
          trusted clinical sources before applying anything in patient care.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/ai/explore">
            <Button size="sm" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Open Explore
            </Button>
          </Link>
          <Link href="/today">
            <Button size="sm" variant="outline" className="gap-1.5">
              Back to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
