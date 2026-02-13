"use client";

import { useEffect, useState } from "react";
import { subscribeStats } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { StatsModel } from "../types/stats";

export function useStats(courseId: string | null) {
  const { uid } = useAuth();
  const [stats, setStats] = useState<StatsModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeStats(uid, courseId, (data) => {
      setStats(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { stats, loading };
}
