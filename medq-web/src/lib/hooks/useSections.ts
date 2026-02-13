"use client";

import { useEffect, useState } from "react";
import { subscribeSections, subscribeSectionsByFile } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { SectionModel } from "../types/section";

export function useSections(courseId: string | null) {
  const { uid } = useAuth();
  const [sections, setSections] = useState<SectionModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setSections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeSections(uid, courseId, (data) => {
      setSections(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { sections, loading };
}

export function useSectionsByFile(fileId: string | null) {
  const { uid } = useAuth();
  const [sections, setSections] = useState<SectionModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !fileId) {
      setSections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeSectionsByFile(uid, fileId, (data) => {
      setSections(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, fileId]);

  return { sections, loading };
}
