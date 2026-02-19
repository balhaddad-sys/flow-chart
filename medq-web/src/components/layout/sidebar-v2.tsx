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

function courseColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `oklch(0.6 0.12 ${hue})`;
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
    <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-border bg-card md:flex">
      {/* Branding */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <span className="block text-base font-bold tracking-tight">MedQ</span>
          <p className="text-[0.625rem] font-medium uppercase tracking-widest text-muted-foreground">
            Study Platform
          </p>
        </div>
      </div>

      {/* Course switcher */}
      {courses.length > 0 && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-1.5 px-1 text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Course
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: activeCourse ? courseColor(activeCourse.title) : "var(--muted-foreground)" }}
              />
              <span className="flex-1 truncate text-left text-[0.8125rem]">
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
      <nav aria-label="Main navigation" className="flex-1 px-3 py-3">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {getInitials(user?.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{user?.displayName || "Student"}</p>
            <p className="truncate text-xs text-muted-foreground leading-tight">{user?.email}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
