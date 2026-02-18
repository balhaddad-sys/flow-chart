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
  { href: "/today", label: "Today", icon: Home, description: "Dashboard & tasks" },
  { href: "/library", label: "Library", icon: Library, description: "Study materials" },
  { href: "/practice", label: "Practice", icon: CircleHelp, description: "Quizzes & assessment" },
  { href: "/ai", label: "AI", icon: Sparkles, description: "Clinical reasoning" },
  { href: "/profile", label: "Profile", icon: User, description: "Account & settings" },
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
    <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-sidebar-border/50 bg-sidebar/95 backdrop-blur-2xl md:flex">
      {/* Branding */}
      <div className="px-5 py-5">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/6 to-transparent p-4 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/18 shadow-sm">
              <GraduationCap className="h-[1.1rem] w-[1.1rem] text-primary" />
            </div>
            <div>
              <span className="block text-[1.0625rem] font-bold tracking-tight text-sidebar-foreground">
                MedQ
              </span>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                AI Study Cockpit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Course switcher */}
      {courses.length > 0 && (
        <div className="px-4 pb-3">
          <p className="mb-1.5 px-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            Active Course
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border/80 bg-card/50 px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent/60 hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white/20"
                style={{ backgroundColor: activeCourse ? courseColor(activeCourse.title) : "var(--muted-foreground)" }}
              />
              <span className="flex-1 truncate text-left text-[0.8125rem]">
                {activeCourse?.title ?? "Select course"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
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
      <nav aria-label="Main navigation" className="relative flex-1 px-3 py-2">
        <p className="mb-2 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Navigation
        </p>

        {/* Sliding active indicator */}
        {activeIndex >= 0 && (
          <div
            className="absolute left-3 right-3 h-[46px] rounded-xl bg-primary/9 border border-primary/18 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(calc(${activeIndex * 52}px + 1.5rem))` }}
          />
        )}

        <div className="relative space-y-1">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-[0.6875rem] text-[0.8125rem] font-medium transition-all duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[1.0625rem] w-[1.0625rem] shrink-0 transition-all duration-200",
                    active
                      ? "text-primary scale-110"
                      : "text-muted-foreground/80 group-hover:text-foreground group-hover:scale-105"
                  )}
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border/50 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/60 group"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[0.6875rem] font-bold text-primary ring-2 ring-primary/10">
            {getInitials(user?.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-semibold leading-tight">{user?.displayName || "Student"}</p>
            <p className="truncate text-[0.6875rem] text-muted-foreground leading-tight mt-0.5">{user?.email}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
