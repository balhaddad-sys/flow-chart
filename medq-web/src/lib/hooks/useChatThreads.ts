"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";
import { useAuth } from "./useAuth";
import type { ChatThread } from "../types/chat";

export function useChatThreads(courseId: string | null) {
  const { uid } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "users", uid, "chatThreads"),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setThreads(
        snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as ChatThread)
          .filter((t) => t.courseId === courseId)
      );
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { threads, loading };
}
