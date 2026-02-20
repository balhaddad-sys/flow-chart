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
const navItems = [
  { href: "/today", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/practice", label: "Practice", icon: CircleHelp },
  { href: "/ai", label: "AI Chat", icon: Sparkles },
  { href: "/profile", label: "Settings", icon: User },
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

export function SidebarV2() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { courses } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);
  const activeCourse = courses.find((c) => c.id === activeCourseId);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-[15rem] flex-col bg-card md:flex">
      {/* Branding */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <GraduationCap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            MedQ
          </span>
          <p className="text-[10px] text-muted-foreground leading-none">Study smarter</p>
        </div>
      </div>

      {/* Course switcher */}
      {courses.length > 0 && (
        <div className="px-3 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg bg-muted/70 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex-1 truncate">
                {activeCourse?.title ?? "Select course"}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {courses.map((course) => (
                <DropdownMenuItem
                  key={course.id}
                  onClick={() => setActiveCourseId(course.id)}
                  className={cn(
                    activeCourseId === course.id && "bg-accent font-medium"
                  )}
                >
                  <span className="truncate">{course.title}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/onboarding?new=1">
                  <PlusCircle className="h-4 w-4" />
                  New Course
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 pt-1">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/70 group-hover:text-foreground"
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary">
            {getInitials(user?.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{user?.displayName || "Student"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
