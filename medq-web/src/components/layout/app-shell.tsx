"use client";

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CourseSwitcherBar } from "./course-switcher-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <CourseSwitcherBar />
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
