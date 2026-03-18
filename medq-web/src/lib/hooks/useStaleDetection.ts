import { useCallback, useEffect, useRef, useState } from "react";

interface StaleDetectionOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  onStale?: () => void;
}

interface StaleDetectionResult {
  isStale: boolean;
  elapsedSec: number;
  reset: () => void;
}

/**
 * Detects when an operation has been loading too long.
 * Shows "Taking longer than expected" with retry option.
 */
export function useStaleDetection(
  isLoading: boolean,
  options: StaleDetectionOptions = {}
): StaleDetectionResult {
  const { timeoutMs = 90_000, pollIntervalMs = 15_000, onStale } = options;
  const [isStale, setIsStale] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef<number>(0);
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  const reset = useCallback(() => {
    setIsStale(false);
    setElapsedSec(0);
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsStale(false);
      setElapsedSec(0);
      return;
    }

    startRef.current = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setElapsedSec(Math.round(elapsed / 1000));

      if (elapsed >= timeoutMs && !isStale) {
        setIsStale(true);
        onStaleRef.current?.();
      }
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [isLoading, timeoutMs, pollIntervalMs, isStale]);

  return { isStale, elapsedSec, reset };
}
