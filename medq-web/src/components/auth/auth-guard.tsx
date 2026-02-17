"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, GraduationCap } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!loading && !user && !error) {
      router.replace("/login");
    }
  }, [user, loading, error, router]);

  // Fade in content when auth resolves
  useEffect(() => {
    if (user && !loading) {
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/12 animate-in-scale">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground animate-in-fade stagger-3">
          Preparing your workspace...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6">
        <div className="glass-card max-w-sm p-8 text-center animate-in-scale">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Connection error</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Could not verify your session. Check your network and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={showContent ? "animate-in-fade" : "opacity-0"}
      style={{ animationDuration: "250ms" }}
    >
      {children}
    </div>
  );
}
