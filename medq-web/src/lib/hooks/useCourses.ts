"use client";

import { useEffect, useState } from "react";
import { subscribeCourses } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { CourseModel } from "../types/course";

export function useCourses() {
  const { uid, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<CourseModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stay in loading state until auth resolves
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!uid) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeCourses(uid, (data) => {
      setCourses(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, authLoading]);

  return { courses, loading };
}
