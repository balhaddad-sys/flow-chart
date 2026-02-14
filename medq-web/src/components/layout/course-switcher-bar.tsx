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
    <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {loading ? (
          <Skeleton className="h-9 w-52" />
        ) : courses.length === 0 ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No courses yet. Create your first course to start.</p>
            <Link href="/onboarding">
              <Button size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active course</p>
              <p className="truncate text-sm font-semibold">{activeCourse?.title ?? "Select course"}</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex min-w-[170px] items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                  <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-left">{activeCourse?.title ?? "Select course"}</span>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
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
              <Link href="/onboarding?new=1">
                <Button size="sm" variant="outline" className="hidden sm:inline-flex">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Course
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
