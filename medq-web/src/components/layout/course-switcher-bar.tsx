"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronsUpDown, GraduationCap, PlusCircle } from "lucide-react";
import { useCourses } from "@/lib/hooks/useCourses";
import { useCourseStore } from "@/lib/stores/course-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CourseSwitcherBar() {
  const { courses, loading } = useCourses();
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);

  const activeCourse = courses.find((course) => course.id === activeCourseId);

  useEffect(() => {
    if (loading) return;

    if (courses.length === 0) {
      if (activeCourseId) setActiveCourseId(null);
      return;
    }

    const activeStillExists = activeCourseId
      ? courses.some((course) => course.id === activeCourseId)
      : false;

    if (!activeStillExists) {
      setActiveCourseId(courses[0].id);
    }
  }, [loading, courses, activeCourseId, setActiveCourseId]);

  return (
    <div className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        {loading ? (
          <Skeleton className="h-9 w-52" />
        ) : courses.length === 0 ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-between">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              No courses yet. Create your first course to start.
            </p>
            <Link href="/onboarding">
              <Button size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm font-semibold shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)] hover:bg-accent">
                <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-left">{activeCourse?.title ?? "Select course"}</span>
                <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {courses.map((course) => (
                  <DropdownMenuItem
                    key={course.id}
                    onClick={() => setActiveCourseId(course.id)}
                    className={cn(activeCourseId === course.id && "bg-accent font-medium")}
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
            <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Active course
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
