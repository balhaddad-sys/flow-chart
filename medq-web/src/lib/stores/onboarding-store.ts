import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingStore {
  step: number;
  courseTitle: string;
  examDate: string;
  examType: string;
  availability: Record<string, number>;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setCourseTitle: (title: string) => void;
  setExamDate: (date: string) => void;
  setExamType: (type: string) => void;
  setDayMinutes: (day: string, minutes: number) => void;
  reset: () => void;
}

const TOTAL_STEPS = 4;

export const useOnboardingStore = create<OnboardingStore>()(persist((set) => ({
  step: 0,
  courseTitle: "",
  examDate: "",
  examType: "SBA",
  availability: {
    monday: 120,
    tuesday: 120,
    wednesday: 120,
    thursday: 120,
    friday: 120,
    saturday: 60,
    sunday: 60,
  },
  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, TOTAL_STEPS - 1) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),
  setCourseTitle: (courseTitle) => set({ courseTitle }),
  setExamDate: (examDate) => set({ examDate }),
  setExamType: (examType) => set({ examType }),
  setDayMinutes: (day, minutes) =>
    set((s) => ({ availability: { ...s.availability, [day]: minutes } })),
  reset: () =>
    set({
      step: 0,
      courseTitle: "",
      examDate: "",
      examType: "SBA",
      availability: {
        monday: 120, tuesday: 120, wednesday: 120,
        thursday: 120, friday: 120, saturday: 60, sunday: 60,
      },
    }),
}), { name: "medq-onboarding" }));
