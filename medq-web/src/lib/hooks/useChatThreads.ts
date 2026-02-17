"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";
import { useAuth } from "./useAuth";
import type { ChatThread } from "../types/chat";

function toMillis(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const timestamp = value as { toMillis?: () => number };
  return typeof timestamp.toMillis === "function" ? timestamp.toMillis() : 0;
}

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
      where("courseId", "==", courseId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setThreads(
        snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as ChatThread)
          .sort(
            (a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)
          )
      );
      setLoading(false);
    });

    return unsub;
  }, [uid, courseId]);

  return { threads, loading };
}
