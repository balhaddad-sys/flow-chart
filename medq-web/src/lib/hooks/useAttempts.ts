"use client";

import { useEffect, useState } from "react";
import { subscribeAttempts } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { AttemptModel } from "../types/attempt";

export function useAttempts(courseId: string | null) {
  const { uid } = useAuth();
  const [attempts, setAttempts] = useState<AttemptModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setAttempts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeAttempts(uid, courseId, (data) => {
      setAttempts(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { attempts, loading };
}
