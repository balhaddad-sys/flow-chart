"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { useCourseStore } from "@/lib/stores/course-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, GraduationCap, CalendarDays, Clock, Upload } from "lucide-react";
import * as fn from "@/lib/firebase/functions";
import { toast } from "sonner";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXAM_TYPES = ["SBA", "OSCE", "Mixed"];

function StepCourse() {
  const { courseTitle, setCourseTitle, examType, setExamType } = useOnboardingStore();

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <GraduationCap className="h-12 w-12 text-primary" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="courseTitle">Course Name</Label>
        <Input
          id="courseTitle"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          placeholder="e.g. Year 3 Medicine"
        />
      </div>
      <div className="space-y-2">
        <Label>Exam Type</Label>
        <div className="flex gap-2">
          {EXAM_TYPES.map((type) => (
            <Button
              key={type}
              variant={examType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setExamType(type)}
            >
              {type}
            </Button>
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
      <div className="flex justify-center">
        <CalendarDays className="h-12 w-12 text-primary" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="examDate">Exam Date</Label>
        <Input
          id="examDate"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
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
      <div className="flex justify-center">
        <Clock className="h-12 w-12 text-primary" />
      </div>
      <p className="text-sm text-center text-muted-foreground">
        How many minutes can you study each day?
      </p>
      <div className="space-y-3">
        {DAYS.map((day, i) => (
          <div key={day} className="flex items-center gap-3">
            <span className="w-10 text-sm font-medium">{DAY_LABELS[i]}</span>
            <Input
              type="number"
              min={0}
              max={480}
              step={15}
              value={availability[day] ?? 120}
              onChange={(e) => setDayMinutes(day, parseInt(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepUpload() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Upload className="h-12 w-12 text-primary" />
      </div>
      <p className="text-sm text-center text-muted-foreground">
        You can upload study materials after setup. Head to the Library to upload
        PDFs, PPTX, or DOCX files.
      </p>
      <div className="rounded-lg border-2 border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Upload materials from the Library page once your course is created.
        </p>
      </div>
    </div>
  );
}

const STEPS = [StepCourse, StepExamDate, StepAvailability, StepUpload];
const STEP_TITLES = ["Create Course", "Exam Date", "Availability", "Upload Materials"];

export default function OnboardingPage() {
  const router = useRouter();
  const { step, nextStep, prevStep, courseTitle, examDate, examType, availability, reset } =
    useOnboardingStore();
  const setActiveCourseId = useCourseStore((s) => s.setActiveCourseId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const StepComponent = STEPS[step];
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
      router.replace("/home");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create course";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Progress value={((step + 1) / STEPS.length) * 100} className="mb-4 h-2" />
          <CardTitle className="text-2xl font-bold">{STEP_TITLES[step]}</CardTitle>
          <CardDescription>
            Step {step + 1} of {STEPS.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <StepComponent />

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {!isFirst && (
              <Button variant="outline" className="flex-1" onClick={prevStep}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button className="flex-1" onClick={handleFinish} disabled={creating || !canProceed}>
                {creating ? "Creating..." : "Finish Setup"}
              </Button>
            ) : (
              <Button className="flex-1" onClick={nextStep} disabled={!canProceed}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
