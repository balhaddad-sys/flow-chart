import { useCallback, useEffect, useRef, useState } from "react";

export interface PhaseProgressState {
  activePhase: string;
  failed: boolean;
  failedMessage: string | null;
  complete: boolean;
  completeMessage: string | null;
  elapsedSec: number;
  isRunning: boolean;
}

interface UsePhaseProgressReturn extends PhaseProgressState {
  /** Advance to a named phase */
  setPhase: (key: string) => void;
  /** Mark the workflow as failed with an optional message */
  setFailed: (message?: string) => void;
  /** Mark the workflow as complete with an optional message */
  setComplete: (message?: string) => void;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Hook to drive a PhaseLoadingCard through a multi-step workflow.
 *
 * Usage:
 * ```ts
 * const progress = usePhaseProgress("idle");
 *
 * async function handleGenerate() {
 *   progress.setPhase("fetch");
 *   const sections = await fetchSections();
 *   progress.setPhase("calc");
 *   const plan = await calculatePlan(sections);
 *   progress.setPhase("save");
 *   await savePlan(plan);
 *   progress.setComplete("Plan saved!");
 * }
 * ```
 */
export function usePhaseProgress(initialPhase = "idle"): UsePhaseProgressReturn {
  const [state, setState] = useState<PhaseProgressState>({
    activePhase: initialPhase,
    failed: false,
    failedMessage: null,
    complete: false,
    completeMessage: null,
    elapsedSec: 0,
    isRunning: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        elapsedSec: Math.round((Date.now() - startRef.current) / 1000),
      }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const setPhase = useCallback(
    (key: string) => {
      if (!state.isRunning) {
        startTimer();
      }
      setState((s) => ({
        ...s,
        activePhase: key,
        failed: false,
        failedMessage: null,
        complete: false,
        isRunning: true,
      }));
    },
    [state.isRunning, startTimer]
  );

  const setFailed = useCallback(
    (message?: string) => {
      stopTimer();
      setState((s) => ({
        ...s,
        failed: true,
        failedMessage: message ?? null,
        isRunning: false,
      }));
    },
    [stopTimer]
  );

  const setComplete = useCallback(
    (message?: string) => {
      stopTimer();
      setState((s) => ({
        ...s,
        complete: true,
        completeMessage: message ?? null,
        isRunning: false,
      }));
    },
    [stopTimer]
  );

  const reset = useCallback(() => {
    stopTimer();
    setState({
      activePhase: initialPhase,
      failed: false,
      failedMessage: null,
      complete: false,
      completeMessage: null,
      elapsedSec: 0,
      isRunning: false,
    });
  }, [initialPhase, stopTimer]);

  return { ...state, setPhase, setFailed, setComplete, reset };
}
