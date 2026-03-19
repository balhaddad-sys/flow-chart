"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin progress bar at the top of the viewport during route transitions.
 * Shows immediately on navigation start, completes when the new path mounts.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Route change detected — show progress
      prevPathname.current = pathname;
      setVisible(true);
      setProgress(0);

      // Animate progress from 0 → 90% quickly
      let p = 0;
      timerRef.current = setInterval(() => {
        p += Math.random() * 15 + 5;
        if (p >= 90) {
          p = 90;
          if (timerRef.current) clearInterval(timerRef.current);
        }
        setProgress(p);
      }, 100);

      // Complete after a short delay (new page has mounted)
      const complete = setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setProgress(100);
        setTimeout(() => setVisible(false), 300);
      }, 400);

      return () => {
        clearTimeout(complete);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px]">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
