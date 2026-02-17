"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  CircleHelp,
  Sparkles,
  User,
  ChevronsUpDown,
  GraduationCap,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo } from "react";

const navItems = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/practice", label: "Practice", icon: CircleHelp },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/today") return pathname === "/today" || pathname.startsWith("/today/");
  if (href === "/ai") return pathname === "/ai" || pathname.startsWith("/ai/");
  if (href === "/practice") {
    return pathname === "/practice" || pathname.startsWith("/practice/") || pathname.startsWith("/study/");
  }
  return pathname.startsWith(href);
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

/** Simple deterministic color from string */
function courseColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `oklch(0.65 0.14 ${hue})`;
}

export function SidebarV2() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { courses } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);
  const activeCourse = courses.find((c) => c.id === activeCourseId);

  const activeIndex = useMemo(
    () => navItems.findIndex((item) => isNavActive(pathname, item.href)),
    [pathname]
  );

  return (
    <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-sidebar-border/60 bg-sidebar/90 backdrop-blur-xl md:flex">
      {/* Branding */}
      <div className="border-b border-sidebar-border/60 px-5 py-5">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/18 via-primary/6 to-transparent p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block text-lg font-semibold tracking-tight text-sidebar-foreground">
                MedQ
              </span>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                AI Study Cockpit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Course switcher */}
      {courses.length > 0 && (
        <div className="border-b border-sidebar-border/60 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/70 bg-card/60 px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent/70 hover:border-primary/25">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: activeCourse ? courseColor(activeCourse.title) : "var(--muted)" }}
              />
              <span className="flex-1 truncate text-left">
                {activeCourse?.title ?? "Select course"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {courses.map((course) => (
                <DropdownMenuItem
                  key={course.id}
                  onClick={() => setActiveCourseId(course.id)}
                  className={cn(
                    "gap-2.5",
                    activeCourseId === course.id && "bg-accent font-medium"
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: courseColor(course.title) }}
                  />
                  <span className="truncate">{course.title}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/onboarding?new=1">
                  <PlusCircle className="h-4 w-4" />
                  Create New Course
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative flex-1 p-3">
        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <div
            className="absolute left-3 right-3 h-[44px] rounded-xl bg-primary/10 border border-primary/20 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(${activeIndex * 50}px)` }}
          />
        )}

        <div className="relative space-y-1.5">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] transition-all duration-200",
                    active
                      ? "text-primary scale-110"
                      : "text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border/60 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/70"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
            {getInitials(user?.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.displayName || "User"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
