/**
 * @file onboarding-store.test.ts
 * @description Comprehensive tests for the onboarding store — simulates
 * real user flows through the course setup wizard.
 */

import { useOnboardingStore } from "./onboarding-store";

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe("Onboarding Store", () => {
  describe("Initial state", () => {
    it("starts at step 0 with defaults", () => {
      const state = useOnboardingStore.getState();
      expect(state.step).toBe(0);
      expect(state.courseTitle).toBe("");
      expect(state.examDate).toBe("");
      expect(state.examType).toBe("SBA");
      expect(state.availability.monday).toBe(120);
      expect(state.availability.saturday).toBe(60);
      expect(state.availability.sunday).toBe(60);
    });
  });

  describe("USER FLOW: Step navigation", () => {
    it("moves forward through steps", () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().step).toBe(1);

      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().step).toBe(2);

      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().step).toBe(3);
    });

    it("does not exceed max step (3)", () => {
      for (let i = 0; i < 10; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().step).toBe(3);
    });

    it("moves backward through steps", () => {
      useOnboardingStore.getState().setStep(3);
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().step).toBe(2);

      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().step).toBe(1);
    });

    it("does not go below step 0", () => {
      useOnboardingStore.getState().prevStep();
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().step).toBe(0);
    });

    it("can jump to specific step", () => {
      useOnboardingStore.getState().setStep(2);
      expect(useOnboardingStore.getState().step).toBe(2);
    });
  });

  describe("USER FLOW: Course title entry", () => {
    it("sets course title", () => {
      useOnboardingStore.getState().setCourseTitle("Cardiology Block 3");
      expect(useOnboardingStore.getState().courseTitle).toBe("Cardiology Block 3");
    });

    it("allows empty title (user clears input)", () => {
      useOnboardingStore.getState().setCourseTitle("Test");
      useOnboardingStore.getState().setCourseTitle("");
      expect(useOnboardingStore.getState().courseTitle).toBe("");
    });
  });

  describe("USER FLOW: Exam configuration", () => {
    it("sets exam date", () => {
      useOnboardingStore.getState().setExamDate("2025-06-15");
      expect(useOnboardingStore.getState().examDate).toBe("2025-06-15");
    });

    it("sets exam type", () => {
      useOnboardingStore.getState().setExamType("OSCE");
      expect(useOnboardingStore.getState().examType).toBe("OSCE");

      useOnboardingStore.getState().setExamType("Mixed");
      expect(useOnboardingStore.getState().examType).toBe("Mixed");
    });
  });

  describe("USER FLOW: Study availability", () => {
    it("customizes individual day minutes", () => {
      useOnboardingStore.getState().setDayMinutes("monday", 60);
      expect(useOnboardingStore.getState().availability.monday).toBe(60);

      useOnboardingStore.getState().setDayMinutes("sunday", 0);
      expect(useOnboardingStore.getState().availability.sunday).toBe(0);
    });

    it("preserves other days when changing one", () => {
      useOnboardingStore.getState().setDayMinutes("monday", 30);

      const avail = useOnboardingStore.getState().availability;
      expect(avail.monday).toBe(30);
      expect(avail.tuesday).toBe(120); // Unchanged
      expect(avail.saturday).toBe(60); // Unchanged
    });
  });

  describe("USER FLOW: Complete onboarding wizard", () => {
    it("simulates a student filling in all fields", () => {
      // Step 0: Enter course title
      useOnboardingStore.getState().setCourseTitle("Medicine Year 3 - Cardiology");
      useOnboardingStore.getState().nextStep();

      // Step 1: Set exam details
      useOnboardingStore.getState().setExamDate("2025-08-20");
      useOnboardingStore.getState().setExamType("SBA");
      useOnboardingStore.getState().nextStep();

      // Step 2: Set study availability
      useOnboardingStore.getState().setDayMinutes("monday", 90);
      useOnboardingStore.getState().setDayMinutes("tuesday", 90);
      useOnboardingStore.getState().setDayMinutes("wednesday", 90);
      useOnboardingStore.getState().setDayMinutes("thursday", 90);
      useOnboardingStore.getState().setDayMinutes("friday", 90);
      useOnboardingStore.getState().setDayMinutes("saturday", 45);
      useOnboardingStore.getState().setDayMinutes("sunday", 30);
      useOnboardingStore.getState().nextStep();

      // Step 3: Confirmation
      const state = useOnboardingStore.getState();
      expect(state.step).toBe(3);
      expect(state.courseTitle).toBe("Medicine Year 3 - Cardiology");
      expect(state.examDate).toBe("2025-08-20");
      expect(state.examType).toBe("SBA");
      expect(state.availability.monday).toBe(90);
      expect(state.availability.saturday).toBe(45);
      expect(state.availability.sunday).toBe(30);
    });
  });

  describe("Reset", () => {
    it("clears all fields back to defaults", () => {
      useOnboardingStore.getState().setCourseTitle("Test");
      useOnboardingStore.getState().setExamDate("2025-12-01");
      useOnboardingStore.getState().setExamType("OSCE");
      useOnboardingStore.getState().setStep(3);
      useOnboardingStore.getState().setDayMinutes("monday", 30);

      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe(0);
      expect(state.courseTitle).toBe("");
      expect(state.examDate).toBe("");
      expect(state.examType).toBe("SBA");
      expect(state.availability.monday).toBe(120);
    });
  });
});
