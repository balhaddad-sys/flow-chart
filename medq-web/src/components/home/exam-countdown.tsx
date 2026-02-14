"use client";

import { Timestamp } from "firebase/firestore";

interface ExamCountdownProps {
  examDate?: Timestamp;
  courseTitle?: string;
}

export function ExamCountdown({ examDate }: ExamCountdownProps) {
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
        : "text-muted-foreground";

  const dateStr = exam.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <span className={`text-sm ${urgencyColor}`}>
      {daysLeft} {daysLeft === 1 ? "day" : "days"} until exam · {dateStr}
    </span>
  );
}
