import { Timestamp } from "firebase/firestore";

export interface UserPreferences {
  pomodoroStyle: string;
  revisionPolicy: string;
  dailyMinutesDefault: number;
  restDayFrequency?: number;
  catchUpBufferPercent: number;
}

export interface UserModel {
  uid: string;
  name: string;
  email: string;
  timezone: string;
  preferences: UserPreferences;
  subscriptionTier: string;
  /** Progressive-profiling: captured post-login via micro-prompts, not during setup */
  examTarget?: "USMLE" | "NCLEX" | "PLAB" | "Finals" | "Other" | null;
  gradYear?: number | null;
  profileCompleteness?: number; // 0–100
  /** Zero-state: true once the sample deck has been seeded */
  hasSeenSampleDeck?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  pomodoroStyle: "25/5",
  revisionPolicy: "standard",
  dailyMinutesDefault: 120,
  catchUpBufferPercent: 15,
};

export const EXAM_TARGETS = ["USMLE", "NCLEX", "PLAB", "Finals", "Other"] as const;
