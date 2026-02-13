import { create } from "zustand";

interface TimerStore {
  seconds: number;
  isRunning: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  getFormatted: () => string;
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  seconds: 0,
  isRunning: false,
  intervalId: null,

  start: () => {
    if (get().isRunning) return;
    const id = setInterval(() => {
      set((s) => ({ seconds: s.seconds + 1 }));
    }, 1000);
    set({ isRunning: true, intervalId: id });
  },

  pause: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ isRunning: false, intervalId: null });
  },

  reset: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ seconds: 0, isRunning: false, intervalId: null });
  },

  getFormatted: () => {
    const { seconds } = get();
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  },
}));
