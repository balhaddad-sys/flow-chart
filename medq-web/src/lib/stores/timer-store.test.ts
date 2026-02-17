/**
 * @file timer-store.test.ts
 * @description Comprehensive tests for the timer store — simulates
 * quiz/assessment timing behavior.
 */

import { useTimerStore } from "./timer-store";

beforeEach(() => {
  useTimerStore.getState().reset();
  jest.useFakeTimers();
});

afterEach(() => {
  useTimerStore.getState().reset(); // Clean up intervals
  jest.useRealTimers();
});

describe("Timer Store", () => {
  describe("Initial state", () => {
    it("starts at 0 seconds, not running", () => {
      const state = useTimerStore.getState();
      expect(state.seconds).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.intervalId).toBeNull();
    });
  });

  describe("USER FLOW: Start timer", () => {
    it("starts counting up", () => {
      useTimerStore.getState().start();
      expect(useTimerStore.getState().isRunning).toBe(true);
      expect(useTimerStore.getState().intervalId).not.toBeNull();

      jest.advanceTimersByTime(3000);
      expect(useTimerStore.getState().seconds).toBe(3);
    });

    it("does not restart if already running", () => {
      useTimerStore.getState().start();
      const firstId = useTimerStore.getState().intervalId;

      useTimerStore.getState().start(); // Should be no-op
      expect(useTimerStore.getState().intervalId).toBe(firstId);
    });
  });

  describe("USER FLOW: Pause timer", () => {
    it("stops the timer but keeps the count", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(5000);

      useTimerStore.getState().pause();

      expect(useTimerStore.getState().isRunning).toBe(false);
      expect(useTimerStore.getState().seconds).toBe(5);
      expect(useTimerStore.getState().intervalId).toBeNull();

      // Time passes but counter doesn't change
      jest.advanceTimersByTime(3000);
      expect(useTimerStore.getState().seconds).toBe(5);
    });

    it("can resume after pause", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(3000);

      useTimerStore.getState().pause();
      expect(useTimerStore.getState().seconds).toBe(3);

      useTimerStore.getState().start();
      jest.advanceTimersByTime(2000);
      expect(useTimerStore.getState().seconds).toBe(5);
    });
  });

  describe("USER FLOW: Reset timer", () => {
    it("resets to 0 and stops", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(10000);

      useTimerStore.getState().reset();

      expect(useTimerStore.getState().seconds).toBe(0);
      expect(useTimerStore.getState().isRunning).toBe(false);
      expect(useTimerStore.getState().intervalId).toBeNull();
    });

    it("can start again after reset", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(5000);
      useTimerStore.getState().reset();

      useTimerStore.getState().start();
      jest.advanceTimersByTime(3000);
      expect(useTimerStore.getState().seconds).toBe(3);
    });
  });

  describe("USER FLOW: Formatted time display", () => {
    it("formats 0 seconds as 00:00", () => {
      expect(useTimerStore.getState().getFormatted()).toBe("00:00");
    });

    it("formats seconds correctly", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(45000);
      expect(useTimerStore.getState().getFormatted()).toBe("00:45");
    });

    it("formats minutes and seconds", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(125000); // 2 min 5 sec
      expect(useTimerStore.getState().getFormatted()).toBe("02:05");
    });

    it("handles large times", () => {
      useTimerStore.getState().start();
      jest.advanceTimersByTime(3600000); // 60 minutes
      expect(useTimerStore.getState().getFormatted()).toBe("60:00");
    });
  });

  describe("USER FLOW: Quiz timing simulation", () => {
    it("simulates timing a 10-question quiz", () => {
      // Student starts quiz
      useTimerStore.getState().start();

      // Answer 10 questions, ~30 seconds each
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(30000);
      }

      // Finish quiz
      useTimerStore.getState().pause();

      const totalSeconds = useTimerStore.getState().seconds;
      expect(totalSeconds).toBe(300); // 5 minutes
      expect(useTimerStore.getState().getFormatted()).toBe("05:00");
    });
  });
});
