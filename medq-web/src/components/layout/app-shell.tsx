"use client";

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CourseSwitcherBar } from "./course-switcher-bar";
import { MedicalDisclaimer } from "./medical-disclaimer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <Sidebar />
      <main className="relative overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-primary/14 via-primary/5 to-transparent"
        />
        <CourseSwitcherBar />
        <MedicalDisclaimer />
        <div className="relative">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
