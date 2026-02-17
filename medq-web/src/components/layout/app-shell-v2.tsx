"use client";

import { SidebarV2 } from "./sidebar-v2";
import { BottomTabBar } from "./bottom-tab-bar";
import { MedicalDisclaimer } from "./medical-disclaimer";
import { FileProcessingNotifier } from "@/components/library/file-processing-notifier";
import { usePathname } from "next/navigation";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[17.5rem_minmax(0,1fr)]">
      <SidebarV2 />
      <main className="relative overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <FileProcessingNotifier />

        {/* Ambient gradient overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/12 via-primary/5 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-12 h-48 w-48 rounded-full bg-primary/8 blur-3xl"
        />

        <MedicalDisclaimer />

        {/* Page content with entrance animation keyed on route */}
        <div key={pathname} className="relative animate-in-up">
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  );
}
