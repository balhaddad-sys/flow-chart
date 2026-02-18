import { Timestamp } from "firebase/firestore";

export interface CourseAvailability {
  defaultMinutesPerDay?: number;
  perDayOverrides?: Record<string, number>;
  /** @deprecated Use perDayOverrides — kept for backward compat with old courses */
  perDay?: Record<string, number>;
  excludedDates?: string[];
}

export interface CourseModel {
  id: string;
  title: string;
  examDate?: Timestamp;
  examType?: string;
  tags: string[];
  availability: CourseAvailability;
  status: string;
  fileCount?: number;
  sectionCount?: number;
  questionCount?: number;
  isSampleDeck?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
