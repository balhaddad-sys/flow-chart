"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, CircleHelp, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
const tabs = [
  { href: "/today", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/practice", label: "Practice", icon: CircleHelp },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/profile", label: "Settings", icon: User },
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
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-lg pb-[max(env(safe-area-inset-bottom),0.25rem)] md:hidden">
      <div className="flex">
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[10px] font-medium transition-colors min-h-[44px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-primary" />
              )}
              <tab.icon className={cn("h-5 w-5", active && "drop-shadow-sm")} strokeWidth={active ? 2.2 : 1.6} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
