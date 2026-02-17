/**
 * @file course-theme-store.test.ts
 * @description Tests for the course store and theme store — simulates
 * real user flows for course selection and theme toggling.
 */

import { useCourseStore } from "./course-store";
import { useThemeStore } from "./theme-store";

describe("Course Store", () => {
  beforeEach(() => {
    useCourseStore.setState({ activeCourseId: null });
  });

  describe("Initial state", () => {
    it("starts with no active course", () => {
      expect(useCourseStore.getState().activeCourseId).toBeNull();
    });
  });

  describe("USER FLOW: Select a course", () => {
    it("sets the active course ID", () => {
      useCourseStore.getState().setActiveCourseId("course-123");
      expect(useCourseStore.getState().activeCourseId).toBe("course-123");
    });

    it("switches between courses", () => {
      useCourseStore.getState().setActiveCourseId("course-1");
      expect(useCourseStore.getState().activeCourseId).toBe("course-1");

      useCourseStore.getState().setActiveCourseId("course-2");
      expect(useCourseStore.getState().activeCourseId).toBe("course-2");
    });

    it("clears active course by setting null", () => {
      useCourseStore.getState().setActiveCourseId("course-1");
      useCourseStore.getState().setActiveCourseId(null);
      expect(useCourseStore.getState().activeCourseId).toBeNull();
    });
  });
});

describe("Theme Store", () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: "system" });
  });

  describe("Initial state", () => {
    it("starts with system mode", () => {
      expect(useThemeStore.getState().mode).toBe("system");
    });
  });

  describe("USER FLOW: Change theme", () => {
    it("sets dark mode", () => {
      useThemeStore.getState().setMode("dark");
      expect(useThemeStore.getState().mode).toBe("dark");
    });

    it("sets light mode", () => {
      useThemeStore.getState().setMode("light");
      expect(useThemeStore.getState().mode).toBe("light");
    });

    it("switches back to system", () => {
      useThemeStore.getState().setMode("dark");
      useThemeStore.getState().setMode("system");
      expect(useThemeStore.getState().mode).toBe("system");
    });

    it("cycles through all modes", () => {
      const modes: ("light" | "dark" | "system")[] = ["light", "dark", "system"];
      for (const mode of modes) {
        useThemeStore.getState().setMode(mode);
        expect(useThemeStore.getState().mode).toBe(mode);
      }
    });
  });
});
