import { Timestamp } from "firebase/firestore";

export interface CourseAvailability {
  defaultMinutesPerDay?: number;
  monday?: number;
  tuesday?: number;
  wednesday?: number;
  thursday?: number;
  friday?: number;
  saturday?: number;
  sunday?: number;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
