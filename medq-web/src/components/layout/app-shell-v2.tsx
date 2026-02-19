"use client";

import { SidebarV2 } from "./sidebar-v2";
import { BottomTabBar } from "./bottom-tab-bar";
import { MedicalDisclaimer } from "./medical-disclaimer";
import { FileProcessingNotifier } from "@/components/library/file-processing-notifier";
import { usePathname } from "next/navigation";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <SidebarV2 />
      <main
        id="main-content"
        className="relative min-h-[100dvh] overflow-y-auto bg-background pb-20 md:pb-0"
      >
        <FileProcessingNotifier />
        <MedicalDisclaimer />
        <div key={pathname} className="animate-in-fade">
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  );
}
