"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Library,
  CircleHelp,
  Settings,
  MessageSquare,
  Users,
  ChevronsUpDown,
  GraduationCap,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  { href: "/home", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/planner", label: "Plan", icon: Calendar },
  { href: "/questions", label: "Practice", icon: CircleHelp },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
];

const secondaryItems = [
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { courses } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  const activeCourse = courses.find((c) => c.id === activeCourseId);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-sidebar-border/70 bg-sidebar/85 backdrop-blur-xl md:flex">
      <div className="border-b border-sidebar-border/70 px-5 py-5">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Learning OS</p>
          <span className="mt-1 block text-2xl font-semibold text-sidebar-foreground">MedQ</span>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="border-b border-sidebar-border/70 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border/80 bg-card/70 px-3 py-2.5 text-sm font-medium hover:bg-accent">
              <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate text-left">
                {activeCourse?.title ?? "Select course"}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                  Create New Course
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1.5 border-t border-sidebar-border/70 p-3">
        {secondaryItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
