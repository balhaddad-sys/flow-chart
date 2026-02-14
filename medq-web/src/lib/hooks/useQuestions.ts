"use client";

import { useEffect, useState } from "react";
import { subscribeQuestions } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { QuestionModel } from "../types/question";

export function useQuestions(courseId: string | null, sectionId: string | null) {
  const { uid } = useAuth();
  const [questions, setQuestions] = useState<QuestionModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId || !sectionId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeQuestions(uid, courseId, sectionId, (data) => {
      setQuestions(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId, sectionId]);

  return { questions, loading };
}
