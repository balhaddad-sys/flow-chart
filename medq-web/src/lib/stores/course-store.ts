import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CourseStore {
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set) => ({
      activeCourseId: null,
      setActiveCourseId: (id) => set({ activeCourseId: id }),
    }),
    { name: "medq-active-course" }
  )
);
