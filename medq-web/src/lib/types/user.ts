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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  pomodoroStyle: "25/5",
  revisionPolicy: "standard",
  dailyMinutesDefault: 120,
  catchUpBufferPercent: 15,
};
