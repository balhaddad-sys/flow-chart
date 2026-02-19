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

export interface ExamOption {
  key: string;
  label: string;
  badge: string;
}

export interface ExamGroup {
  group: string;
  exams: ExamOption[];
}

export const EXAM_CATALOG: ExamGroup[] = [
  {
    group: "UK Licensing",
    exams: [
      { key: "PLAB1", label: "PLAB 1",     badge: "180 SBAs · GMC"        },
      { key: "PLAB2", label: "PLAB 2",     badge: "18 stations · OSCE"    },
    ],
  },
  {
    group: "UK Specialty",
    exams: [
      { key: "MRCP_PART1",  label: "MRCP Part 1",  badge: "Best of Five · RCP"   },
      { key: "MRCP_PACES",  label: "MRCP PACES",   badge: "5 stations · Clinical" },
      { key: "MRCGP_AKT",   label: "MRCGP AKT",   badge: "200 MCQs · GP"         },
    ],
  },
  {
    group: "International",
    exams: [
      { key: "USMLE_STEP1", label: "USMLE Step 1",    badge: "Basic science · NBME" },
      { key: "USMLE_STEP2", label: "USMLE Step 2 CK", badge: "Clinical knowledge"    },
    ],
  },
  {
    group: "University",
    exams: [
      { key: "FINALS", label: "Medical Finals", badge: "SBA + OSCE · University" },
      { key: "SBA",    label: "SBA Practice",   badge: "General SBA"             },
      { key: "OSCE",   label: "OSCE Practice",  badge: "General OSCE"            },
    ],
  },
];
