"use client";

import { useEffect, useState } from "react";
import { subscribeFiles } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { FileModel } from "../types/file";

export function useFiles(courseId: string | null) {
  const { uid } = useAuth();
  const [files, setFiles] = useState<FileModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeFiles(uid, courseId, (data) => {
      setFiles(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { files, loading };
}
