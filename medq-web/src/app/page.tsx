import Link from "next/link";
import {
  Upload,
  BrainCircuit,
  Calendar,
  MessageSquare,
  Compass,
  Target,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Upload & Analyze",
    description:
      "Drop in your lecture PDFs, slides, or Word docs. AI breaks them into study-ready sections in seconds.",
  },
  {
    icon: BrainCircuit,
    title: "Adaptive Assessment",
    description:
      "Diagnose your strengths and weaknesses across any medical topic with AI-calibrated questions.",
  },
  {
    icon: Compass,
    title: "Explore Any Topic",
    description:
      "Type any medical topic and get instant AI-generated quiz questions — no uploads required.",
  },
  {
    icon: Calendar,
    title: "Smart Study Plans",
    description:
      "AI builds a personalised daily schedule based on your exam date, availability, and weak areas.",
  },
  {
    icon: Target,
    title: "Practice & Quiz",
    description:
      "Section quizzes, topic drills, smart mix, and random modes — all with instant explanations.",
  },
  {
    icon: MessageSquare,
    title: "AI Study Chat",
    description:
      "Ask questions about your materials. Get explanations grounded in what you're actually studying.",
  },
];

const stats = [
  { value: "8", label: "Medical Levels" },
  { value: "AI", label: "Powered Questions" },
  { value: "24/7", label: "Study Assistant" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-semibold tracking-tight">MedQ</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28 md:pt-36">
        {/* Ambient hero glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-96 w-[600px] rounded-full bg-primary/8 blur-[100px]"
        />

        <div className="relative animate-in-up stagger-1 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Medical Learning
        </div>

        <h1 className="relative animate-in-up stagger-2 mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl md:text-6xl">
          Study smarter.{" "}
          <span className="text-gradient">Score higher.</span>
        </h1>

        <p className="relative animate-in-up stagger-3 mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Upload your medical materials, get AI-generated study plans and quizzes,
          and track your progress from MD1 through postgraduate — all in one place.
        </p>

        <div className="relative animate-in-up stagger-4 mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/80 px-6 py-3 text-sm font-medium transition-all hover:bg-accent hover:border-primary/20 active:scale-[0.98]"
          >
            I have an account
          </Link>
        </div>

        {/* Stats row */}
        <div className="relative animate-in-up stagger-5 mt-14 flex flex-wrap justify-center gap-8 sm:gap-14">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-semibold sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to ace your exams
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            From first-year foundations to postgraduate mastery — MedQ adapts to
            your level and learning style.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="surface-interactive group rounded-2xl border border-border/70 bg-card/85 p-6 backdrop-blur-sm"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 transition-colors group-hover:bg-primary/18">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="surface-hero rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to transform your study routine?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Join medical students using AI to study more effectively. Free to get started.
          </p>
          <Link
            href="/signup"
            className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
          >
            Create Free Account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border/40 bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">MedQ</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MedQ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
