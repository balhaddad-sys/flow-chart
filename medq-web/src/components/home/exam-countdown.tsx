"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface ExamCountdownProps {
  examDate?: Timestamp;
  courseTitle?: string;
}

export function ExamCountdown({ examDate, courseTitle }: ExamCountdownProps) {
  if (!examDate) return null;

  const exam = examDate.toDate();
  const now = new Date();
  const diffMs = exam.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const urgencyColor =
    daysLeft <= 7
      ? "text-red-500"
      : daysLeft <= 30
        ? "text-orange-500"
        : "text-blue-500";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg bg-muted p-2 ${urgencyColor}`}>
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {courseTitle ?? "Exam"} in
          </p>
          <p className={`text-2xl font-bold ${urgencyColor}`}>
            {daysLeft} {daysLeft === 1 ? "day" : "days"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {exam.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
