import { useEffect, useRef, useState } from "react";

/**
 * Debounce a rapidly-changing value.
 * Returns the latest value only after `delay` ms of inactivity.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Returns a debounced version of `callback`.
 * The returned function can be called rapidly; only the last invocation
 * within `delay` ms will actually fire.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (...args: Args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => cbRef.current(...args), delay);
  };
}
