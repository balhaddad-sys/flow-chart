"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, CircleHelp, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/practice", label: "Practice", icon: CircleHelp },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
];

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/today") return pathname === "/today" || pathname.startsWith("/today/");
  if (href === "/ai") return pathname === "/ai" || pathname.startsWith("/ai/");
  if (href === "/practice") {
    return pathname === "/practice" || pathname.startsWith("/practice/") || pathname.startsWith("/study/");
  }
  return pathname.startsWith(href);
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 flex rounded-2xl border border-border/70 bg-card/90 shadow-[0_20px_40px_-26px_rgba(15,23,42,0.9)] backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.2rem)] md:hidden">
      {tabs.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] transition-all",
              active ? "bg-primary/12 text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
