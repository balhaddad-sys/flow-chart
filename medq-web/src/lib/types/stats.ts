import { Timestamp } from "firebase/firestore";

export interface WeakTopic {
  tag: string;
  weaknessScore: number;
  accuracy: number;
}

export interface StatsModel {
  courseId: string;
  totalStudyMinutes: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number; // 0-1 range
  weeklyStudyMinutes?: number; // Not yet populated by backend
  completionPercent: number; // 0-1 range (multiply by 100 for display)
  weakestTopics: WeakTopic[];
  streakDays?: number; // Not yet populated by backend
  lastStudiedAt?: Timestamp;
  updatedAt?: Timestamp;
}
