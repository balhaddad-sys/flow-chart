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

      // Logarithmic ease — fast start, naturally decelerates toward 90%
      let p = 0;
      timerRef.current = setInterval(() => {
        p += (90 - p) * 0.15;
        if (p >= 89.5) {
          p = 90;
          if (timerRef.current) clearInterval(timerRef.current);
        }
        setProgress(p);
      }, 100);

      // Complete after a short delay. Next.js App Router doesn't expose
      // route-transition-end events, so we use a fixed timeout as a
      // best-effort signal that the new page has mounted. For heavier
      // routes the bar may complete slightly before content appears.
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
