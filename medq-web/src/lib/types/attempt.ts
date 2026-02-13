import { Timestamp } from "firebase/firestore";

export interface AttemptModel {
  id: string;
  questionId: string;
  courseId: string;
  taskId?: string;
  answeredIndex: number;
  correct: boolean;
  timeSpentSec: number;
  confidence?: number;
  tutorResponseCached?: Record<string, unknown>;
  createdAt?: Timestamp;
}
