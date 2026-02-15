"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

const DISMISS_KEY = "medq_disclaimer_dismissed_v1";

export function MedicalDisclaimer() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      setHidden(dismissed === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore localStorage failures.
    }
  }

  if (hidden) return null;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 sm:px-6">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="min-w-0 flex-1 leading-relaxed">
          MedQ is for education only. It does not provide clinical advice and must not be used for patient-care decisions.{" "}
          <Link href="/terms" className="font-medium underline decoration-amber-600/60 underline-offset-2">
            Learn more
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-amber-500/20"
          aria-label="Dismiss disclaimer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

