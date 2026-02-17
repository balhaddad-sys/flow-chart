"use client";

import { useSyncExternalStore } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase/client";

interface AuthSnapshot {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

const INITIAL_SNAPSHOT: AuthSnapshot = {
  user: null,
  loading: true,
  error: null,
};

let snapshot: AuthSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();
let unsubscribeAuth: (() => void) | null = null;
let authListenerActive = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function startAuthListener() {
  if (authListenerActive || typeof window === "undefined") return;

  authListenerActive = true;
  unsubscribeAuth = onAuthStateChanged(
    auth,
    (user) => {
      snapshot = {
        user,
        loading: false,
        error: null,
      };
      emit();
    },
    (error) => {
      snapshot = {
        user: null,
        loading: false,
        error,
      };
      emit();
    }
  );
}

function stopAuthListener() {
  if (!authListenerActive) return;

  unsubscribeAuth?.();
  unsubscribeAuth = null;
  authListenerActive = false;
  snapshot = INITIAL_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startAuthListener();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopAuthListener();
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    uid: state.user?.uid ?? null,
  };
}
