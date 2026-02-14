"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Library, BarChart3, Settings, MessageSquare, Users, ChevronsUpDown, GraduationCap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/planner", label: "Planner", icon: Calendar },
  { href: "/library", label: "Library", icon: Library },
  { href: "/dashboard", label: "Insights", icon: BarChart3 },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
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
    <aside className="hidden md:flex w-64 xl:w-72 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <span className="text-xl font-bold text-primary">MedQ</span>
      </div>

      {courses.length > 0 && (
        <div className="border-b p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
