"use client";

import { SidebarV2 } from "./sidebar-v2";
import { BottomTabBar } from "./bottom-tab-bar";
import { MedicalDisclaimer } from "./medical-disclaimer";
import { FileProcessingNotifier } from "@/components/library/file-processing-notifier";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <SidebarV2 />
      <main className="relative overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <FileProcessingNotifier />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-primary/14 via-primary/5 to-transparent"
        />
        <MedicalDisclaimer />
        <div className="relative">{children}</div>
      </main>
      <BottomTabBar />
    </div>
  );
}
