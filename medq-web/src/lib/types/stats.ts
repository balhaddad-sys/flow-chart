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
  overallAccuracy: number;
  weeklyStudyMinutes: number;
  completionPercent: number;
  weakestTopics: WeakTopic[];
  streakDays: number;
  lastStudiedAt?: Timestamp;
  updatedAt?: Timestamp;
}
