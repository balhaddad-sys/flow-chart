"use client";

import Link from "next/link";
import { SidebarV2 } from "./sidebar-v2";
import { BottomTabBar } from "./bottom-tab-bar";
import { MedicalDisclaimer } from "./medical-disclaimer";
import { FileProcessingNotifier } from "@/components/library/file-processing-notifier";
import { RouteProgress } from "./route-progress";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

function MobileHeader() {
  const { user } = useAuth();
  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 md:hidden">
      <span className="text-sm font-bold tracking-tight">MedQ</span>
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        aria-label="Settings"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {initials}
        </div>
      </Link>
    </div>
  );
}

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <RouteProgress />
      <SidebarV2 />
      <main id="main-content" className="relative overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <MobileHeader />
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
