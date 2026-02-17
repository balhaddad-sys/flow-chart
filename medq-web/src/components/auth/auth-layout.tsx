import Link from "next/link";
import { GraduationCap, BookOpen, BrainCircuit, Target, Sparkles } from "lucide-react";

const highlights = [
  { icon: BookOpen, text: "Upload and analyze study materials in seconds" },
  { icon: BrainCircuit, text: "AI-generated quizzes calibrated to your level" },
  { icon: Target, text: "Adaptive assessment to find your weak spots" },
  { icon: Sparkles, text: "Smart study plans built around your schedule" },
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      {/* Left decorative panel — desktop only */}
      <div className="hidden w-[45%] max-w-[520px] flex-col justify-between bg-gradient-to-br from-primary/12 via-primary/6 to-transparent p-10 lg:flex">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-semibold tracking-tight">MedQ</span>
          </Link>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-balance leading-snug">
            Study smarter with{" "}
            <span className="text-gradient">AI-powered</span>
            {" "}medical learning
          </h2>
          <div className="space-y-4">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <h.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                  {h.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} MedQ. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-semibold tracking-tight">MedQ</span>
        </div>

        <div className="w-full max-w-md animate-in-up">
          {children}
        </div>
      </div>
    </div>
  );
}
