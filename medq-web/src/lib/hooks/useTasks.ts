"use client";

import { useEffect, useState } from "react";
import { subscribeTasks, subscribeTodayTasks } from "../firebase/firestore";
import { useAuth } from "./useAuth";
import type { TaskModel } from "../types/task";

export function useTasks(courseId: string | null) {
  const { uid } = useAuth();
  const [tasks, setTasks] = useState<TaskModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTasks(uid, courseId, (data) => {
      setTasks(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { tasks, loading };
}

export function useTodayTasks(courseId: string | null) {
  const { uid } = useAuth();
  const [tasks, setTasks] = useState<TaskModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !courseId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTodayTasks(uid, courseId, (data) => {
      setTasks(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, courseId]);

  return { tasks, loading };
}
