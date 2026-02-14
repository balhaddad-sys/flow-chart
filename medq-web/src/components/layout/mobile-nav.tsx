"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Calendar,
  Library,
  CircleHelp,
  MessageSquare,
  MoreHorizontal,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const mainItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/planner", label: "Plan", icon: Calendar },
  { href: "/questions", label: "Practice", icon: CircleHelp },
];

const moreItems = [
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 flex rounded-2xl border border-border/70 bg-card/90 shadow-[0_20px_40px_-26px_rgba(15,23,42,0.9)] backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.2rem)] md:hidden">
      {mainItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] transition-all",
              isActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] transition-all",
              isMoreActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl border-border/70 bg-card/95 pb-8 backdrop-blur-xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs transition-colors",
                    isActive
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
