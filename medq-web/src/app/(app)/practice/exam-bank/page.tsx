"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import { useStats } from "@/lib/hooks/useStats";
import { useAuth } from "@/lib/hooks/useAuth";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { EXAM_CATALOG } from "@/lib/types/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoadingState } from "@/components/ui/loading-state";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Zap,
  BookOpen,
  Target,
  CheckCircle2,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import type { Timestamp as TSTimestamp } from "firebase/firestore";

// ── Exam metadata ─────────────────────────────────────────────────────────────

const EXAM_META: Record<
  string,
  { format: string; authority: string; focus: string; tip: string; color: string }
> = {
  PLAB1: {
    format: "180 SBAs · 3 hours",
    authority: "GMC UK",
    focus: "Clinical reasoning, UK guidelines, prescribing safety, GMC ethics",
    tip: "Anchor every answer to NICE guidelines and BNF drug choices. GMC ethics questions follow Good Medical Practice — know it.",
    color: "blue",
  },
  PLAB2: {
    format: "18 OSCE stations · ~3 hours",
    authority: "GMC UK",
    focus: "Clinical examination, communication, history taking, data interpretation",
    tip: "Use SOCRATES for pain, ICE for patient concerns, SBAR for handover. Every station has a hidden communication mark.",
    color: "blue",
  },
  MRCP_PART1: {
    format: "Best of Five · 200 questions",
    authority: "Royal Colleges UK",
    focus: "Mechanism-level medicine, rare presentations, investigation logic",
    tip: "Know the pathophysiology behind each drug — Best of Five rewards mechanism understanding, not pattern-matching.",
    color: "purple",
  },
  MRCP_PACES: {
    format: "5 clinical stations · 2 hours",
    authority: "Royal Colleges UK",
    focus: "Physical examination, history, communication, data interpretation, ethics",
    tip: "Communication station: use IDEAS framework. Examiners mark empathy and structure separately from medical content.",
    color: "purple",
  },
  MRCGP_AKT: {
    format: "200 MCQs · 3 hours",
    authority: "RCGP",
    focus: "Primary care, QOF, NNT, drug thresholds, referral pathways",
    tip: "Know QOF targets, QRISK thresholds, and when NOT to prescribe. Extended matching items (EMIs) need fast elimination.",
    color: "green",
  },
  USMLE_STEP1: {
    format: "280 questions · 8 hours",
    authority: "NBME",
    focus: "Basic science mechanisms, pathophysiology, pharmacology, microbiology",
    tip: "Every clinical vignette links to basic science. Always ask 'what is the underlying mechanism?' before choosing an answer.",
    color: "amber",
  },
  USMLE_STEP2: {
    format: "318 questions · 9 hours",
    authority: "NBME",
    focus: "Clinical management, AHA/ACC/USPSTF guidelines, next best step",
    tip: "NBME tests first-line management and 'next best step'. Know the algorithm, not just the drug.",
    color: "amber",
  },
  FINALS: {
    format: "SBA + OSCE · varies by university",
    authority: "University",
    focus: "Common presentations, prescribing, clinical communication, emergencies",
    tip: "Cover common things commonly. 80% of marks come from bread-and-butter medicine presented with subtle complexity.",
    color: "emerald",
  },
};

const COLOR_MAP: Record<
  string,
  { badge: string; icon: string; ring: string; bar: string; accent: string }
> = {
  blue: {
    badge: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
    icon: "bg-blue-500/15 text-blue-500",
    ring: "border-blue-500/30",
    bar: "from-blue-400 via-blue-500 to-sky-500",
    accent: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    badge: "bg-purple-500/12 text-purple-700 dark:text-purple-300",
    icon: "bg-purple-500/15 text-purple-500",
    ring: "border-purple-500/30",
    bar: "from-purple-400 via-purple-500 to-violet-500",
    accent: "text-purple-600 dark:text-purple-400",
  },
  green: {
    badge: "bg-green-500/12 text-green-700 dark:text-green-300",
    icon: "bg-green-500/15 text-green-500",
    ring: "border-green-500/30",
    bar: "from-green-400 via-green-500 to-emerald-500",
    accent: "text-green-600 dark:text-green-400",
  },
  amber: {
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    icon: "bg-amber-500/15 text-amber-500",
    ring: "border-amber-500/30",
    bar: "from-amber-400 via-amber-500 to-orange-500",
    accent: "text-amber-600 dark:text-amber-400",
  },
  emerald: {
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/15 text-emerald-500",
    ring: "border-emerald-500/30",
    bar: "from-emerald-400 via-emerald-500 to-teal-500",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
};

function daysUntil(ts: TSTimestamp | undefined): number | null {
  if (!ts) return null;
  const ms = ts.toDate().getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function ExamBankPage() {
  const { uid } = useAuth();
  const { courses, loading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const activeCourse = useMemo(
    () => courses.find((c) => c.id === (activeCourseId || courses[0]?.id)),
    [courses, activeCourseId]
  );
  const { stats } = useStats(activeCourse?.id ?? null);

  const [examDateInput, setExamDateInput] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const examType = (activeCourse?.examType ?? "SBA").toUpperCase();
  const examMeta = EXAM_META[examType];
  const examEntry = useMemo(
    () => EXAM_CATALOG.flatMap((g) => g.exams).find((e) => e.key === examType),
    [examType]
  );

  const colors = COLOR_MAP[examMeta?.color ?? "blue"] ?? COLOR_MAP.blue;
  const daysLeft = daysUntil(activeCourse?.examDate as TSTimestamp | undefined);

  async function handleSaveDate() {
    if (!uid || !activeCourse?.id || !examDateInput) return;
    const date = new Date(examDateInput);
    if (isNaN(date.getTime())) {
      toast.error("Please enter a valid date.");
      return;
    }
    setSavingDate(true);
    try {
      await updateDoc(doc(db, "users", uid, "courses", activeCourse.id), {
        examDate: Timestamp.fromDate(date),
      });
      toast.success("Exam date saved!");
      setExamDateInput("");
    } catch {
      toast.error("Failed to save exam date.");
    } finally {
      setSavingDate(false);
    }
  }

  if (loading) {
    return (
      <PageLoadingState
        title="Loading your exam bank"
        description="Fetching your course and exam details."
        className="page-wrap py-16"
      />
    );
  }

  if (!activeCourse || !examMeta) {
    return (
      <div className="page-wrap py-24 text-center space-y-4">
        <p className="text-muted-foreground text-sm">
          No exam-specific question bank for this course. Select a specific exam
          in your course settings.
        </p>
        <Link href="/practice">
          <Button variant="outline" size="sm" className="rounded-xl">
            Go to Practice
          </Button>
        </Link>
      </div>
    );
  }

  const statItems = [
    {
      label: "Questions Answered",
      value: stats?.totalQuestionsAnswered ?? 0,
    },
    {
      label: "Accuracy",
      value:
        stats?.overallAccuracy != null
          ? `${Math.round(stats.overallAccuracy * 100)}%`
          : "—",
    },
    { label: "Study Minutes", value: stats?.totalStudyMinutes ?? 0 },
    { label: "Streak", value: stats?.streakDays ? `${stats.streakDays}d` : "—" },
  ];

  return (
    <div className="page-wrap page-stack">
      {/* Back */}
      <Link
        href="/today"
        className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className={`glass-card overflow-hidden border ${colors.ring}`}>
        <div className={`h-1 w-full bg-gradient-to-r ${colors.bar}`} />
        <div className="p-5 sm:p-7 space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            {/* Exam identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.icon}`}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold leading-tight">
                    {examEntry?.label ?? examType}
                  </h1>
                  <p className="text-xs text-muted-foreground">{examMeta.authority}</p>
                </div>
                <Badge className={`${colors.badge} border-0 text-xs`}>
                  {examEntry?.badge ?? examMeta.format}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                {examMeta.focus}
              </p>
            </div>

            {/* Countdown / Date picker */}
            {daysLeft !== null ? (
              <div className="shrink-0 rounded-2xl border border-border/60 bg-muted/30 px-6 py-4 text-center min-w-[120px]">
                <p className="text-4xl font-bold tabular-nums">
                  {daysLeft}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {daysLeft === 0 ? "Exam day!" : daysLeft === 1 ? "day to go" : "days to go"}
                </p>
                <button
                  onClick={() => setExamDateInput("")}
                  className="mt-2 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  Change date
                </button>
              </div>
            ) : (
              <div className="shrink-0 rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium">When is your exam?</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={examDateInput}
                    onChange={(e) => setExamDateInput(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveDate}
                    disabled={!examDateInput || savingDate}
                    className="rounded-lg"
                  >
                    {savingDate ? "…" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/70">
                  We&apos;ll build a countdown and prioritise revision.
                </p>
              </div>
            )}
          </div>

          {/* Exam tip */}
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5">
            <Zap className={`h-4 w-4 shrink-0 mt-0.5 ${colors.accent}`} />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Exam tip: </span>
              {examMeta.tip}
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statItems.map(({ label, value }) => (
          <div key={label} className="glass-card p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </section>

      {/* ── Weak topics ───────────────────────────────────────────────────── */}
      {(stats?.weakestTopics?.length ?? 0) > 0 && (
        <section className="glass-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Focus areas</h2>
            <Link
              href="/today/analytics"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Full analytics
            </Link>
          </div>
          <div className="space-y-2.5">
            {stats!.weakestTopics.slice(0, 5).map((topic) => (
              <div key={topic.tag} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{topic.tag}</span>
                <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500/70"
                    style={{
                      width: `${Math.round((1 - (topic.accuracy ?? 0)) * 100)}%`,
                    }}
                  />
                </div>
                <Link
                  href={`/ai/explore?topic=${encodeURIComponent(topic.tag)}`}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  Explore
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Practice modes ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="section-label">Start Practising</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/practice/quiz?mode=mixed",
              icon: Zap,
              iconClass: "bg-primary/12 text-primary",
              title: "Smart Mix",
              desc: "AI-weighted questions targeting your weakest areas first",
              span: false,
            },
            {
              href: "/practice/quiz?mode=random",
              icon: BookOpen,
              iconClass: "bg-muted text-muted-foreground",
              title: "Random Quiz",
              desc: "Random questions from all your uploaded materials",
              span: false,
            },
            {
              href: "/practice",
              icon: CheckCircle2,
              iconClass: "bg-muted text-muted-foreground",
              title: "Browse by Topic",
              desc: "Choose specific topics or sections to drill",
              span: true,
            },
            {
              href: `/ai/explore?topic=${encodeURIComponent(examEntry?.label ?? examType)}`,
              icon: Compass,
              iconClass: "bg-muted text-muted-foreground",
              title: "Explore & Learn",
              desc: "Structured teaching + quiz on any topic from your syllabus",
              span: true,
            },
          ].map(({ href, icon: Icon, iconClass, title, desc, span }) => (
            <Link
              key={href}
              href={href}
              className={`block ${span ? "sm:col-span-2" : ""}`}
            >
              <div className="glass-card flex cursor-pointer items-center gap-3 p-4 transition-colors hover:border-primary/40 group">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${iconClass} group-hover:scale-105`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
