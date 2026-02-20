"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";
import { useAuth } from "./useAuth";
import type { ExploreQuestion } from "../firebase/functions";

interface ExamBankData {
  questions: ExploreQuestion[];
  totalCount: number;
  domainsGenerated: string[];
  lastGeneratedAt: string | null;
}

const EMPTY: ExamBankData = {
  questions: [],
  totalCount: 0,
  domainsGenerated: [],
  lastGeneratedAt: null,
};

export function useExamBank(examType: string | null) {
  const { uid } = useAuth();
  const [data, setData] = useState<ExamBankData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !examType) {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, "users", uid, "examBank", examType);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setData({
            questions: Array.isArray(d.questions) ? d.questions : [],
            totalCount: typeof d.totalCount === "number" ? d.totalCount : 0,
            domainsGenerated: Array.isArray(d.domainsGenerated) ? d.domainsGenerated : [],
            lastGeneratedAt: d.lastGeneratedAt?.toDate?.()?.toISOString() ?? null,
          });
        } else {
          setData(EMPTY);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid, examType]);

  return { ...data, loading, error };
}
