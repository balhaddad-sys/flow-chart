"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { useCourseStore } from "@/lib/stores/course-store";
import { useCourses } from "@/lib/hooks/useCourses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoadingState, LoadingButtonLabel } from "@/components/ui/loading-state";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  Clock,
  Upload,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXAM_TYPES = ["SBA", "OSCE", "Mixed"];

function StepCourse() {
  const { courseTitle, setCourseTitle, examType, setExamType } = useOnboardingStore();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="courseTitle" className="text-sm font-medium">Course Name</Label>
        <Input
          id="courseTitle"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          placeholder="e.g. Year 3 Medicine"
          className="h-11 rounded-xl"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Exam Type</Label>
        <div className="flex gap-2">
          {EXAM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExamType(type)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                examType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepExamDate() {
  const { examDate, setExamDate } = useOnboardingStore();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="examDate" className="text-sm font-medium">Exam Date</Label>
        <Input
          id="examDate"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="h-11 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          This helps create an optimal study schedule.
        </p>
      </div>
    </div>
  );
}

function StepAvailability() {
  const { availability, setDayMinutes } = useOnboardingStore();

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-muted-foreground">
        How many minutes can you study each day?
      </p>
      <div className="grid gap-2">
        {DAYS.map((day, i) => {
          const minutes = availability[day] ?? 120;
          const isActive = minutes > 0;
          return (
            <div
              key={day}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all",
                isActive
                  ? "border-primary/25 bg-primary/5"
                  : "border-border/60"
              )}
            >
              <span className="w-10 text-sm font-medium">{DAY_LABELS[i]}</span>
              <Input
                type="number"
                min={0}
                max={480}
                step={15}
                value={minutes}
                onChange={(e) => setDayMinutes(day, parseInt(e.target.value) || 0)}
                className="h-9 w-24 rounded-lg text-center"
              />
              <span className="text-xs text-muted-foreground">min</span>
              {isActive && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepUpload() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-muted-foreground">
        You can upload study materials after setup. Head to the Library to upload
        PDFs, PPTX, or DOCX files.
      </p>
      <div className="rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 p-8 text-center">
        <Upload className="mx-auto h-8 w-8 text-primary/60" />
        <p className="mt-3 text-sm text-muted-foreground">
          Upload materials from the Library page once your course is created.
        </p>
      </div>
    </div>
  );
}

const STEPS = [StepCourse, StepExamDate, StepAvailability, StepUpload];
const STEP_TITLES = ["Create Course", "Exam Date", "Availability", "Upload Materials"];
const STEP_ICONS = [GraduationCap, CalendarDays, Clock, Upload];

export default function OnboardingPage() {
  const router = useRouter();
  const { step, nextStep, prevStep, courseTitle, examDate, examType, availability, reset } =
    useOnboardingStore();
  const { courses, loading: coursesLoading } = useCourses();
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);
  const activeCourseId = useCourseStore((s) => s.activeCourseId);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setShowCreateFlow(true);
    }
  }, []);

  function handleContinueWithCourse(courseId: string) {
    setActiveCourseId(courseId);
    reset();
    router.replace("/today");
  }

  if (coursesLoading && !showCreateFlow) {
    return (
      <PageLoadingState
        title="Loading your courses"
        description="Fetching your existing courses before setup."
        minHeightClassName="min-h-[100dvh]"
        className="p-4"
      />
    );
  }

  if (!coursesLoading && courses.length > 0 && !showCreateFlow) {
    const selectedCourse =
      courses.find((course) => course.id === activeCourseId) ?? courses[0];

    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="glass-card w-full max-w-xl rounded-2xl p-1">
          <div className="rounded-[calc(1rem-2px)] bg-card p-6 sm:p-8">
            <div className="text-center space-y-2 animate-in-up stagger-1">
              <h1 className="text-2xl font-semibold tracking-tight">You Already Have Courses</h1>
              <p className="text-sm text-muted-foreground">
                Continue with an existing course or create a new one.
              </p>
            </div>

            <div className="mt-6 space-y-2 animate-in-up stagger-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleContinueWithCourse(course.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3.5 text-left transition-all",
                    selectedCourse.id === course.id
                      ? "border-primary/40 bg-primary/8 shadow-sm"
                      : "border-border/60 hover:border-primary/25 hover:bg-accent/50"
                  )}
                >
                  <p className="font-medium">{course.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {course.examType || "General"} {course.examDate ? "| exam date set" : ""}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3 animate-in-up stagger-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => handleContinueWithCourse(selectedCourse.id)}
              >
                Continue Existing
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl"
                onClick={() => setShowCreateFlow(true)}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Create New Course
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const StepComponent = STEPS[step];
  const StepIcon = STEP_ICONS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const canProceed = step === 0 ? courseTitle.trim().length > 0 : true;

  async function handleFinish() {
    if (!courseTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await fn.createCourse({
        title: courseTitle.trim(),
        examDate: examDate || undefined,
        examType,
        availability,
      });
      const courseId = (result as { courseId?: string }).courseId;
      if (courseId) {
        setActiveCourseId(courseId);
      }
      reset();
      router.replace("/library");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create course";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 h-72 w-96 rounded-full bg-primary/8 blur-[100px]"
      />

      <div className="relative glass-card w-full max-w-lg rounded-2xl p-1">
        <div className="rounded-[calc(1rem-2px)] bg-card p-6 sm:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                      ? "bg-primary/15 text-primary border-2 border-primary/40"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {i < step ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-8 rounded-full transition-colors duration-300",
                      i < step ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step header */}
          <div className="text-center mb-6" key={step}>
            <div className="animate-in-scale mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <h1 className="animate-in-up stagger-1 text-xl font-semibold tracking-tight">
              {STEP_TITLES[step]}
            </h1>
            <p className="animate-in-up stagger-2 mt-1 text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>

          {/* Step content */}
          <div key={`content-${step}`} className="animate-in-up stagger-2">
            <StepComponent />
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {!isFirst && (
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={prevStep}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                className="flex-1 h-11 rounded-xl"
                onClick={handleFinish}
                disabled={creating || !canProceed}
              >
                {creating ? (
                  <LoadingButtonLabel label="Creating..." />
                ) : (
                  <>
                    Finish Setup
                    <Sparkles className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="flex-1 h-11 rounded-xl"
                onClick={nextStep}
                disabled={!canProceed}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
