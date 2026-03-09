/**
 * Lightweight client-side error reporter.
 *
 * Batches errors and sends them to the backend. Drop-in replacement point
 * for Sentry or Datadog RUM — swap the `flush` implementation when ready.
 */

const BUFFER_MAX = 10;
const FLUSH_INTERVAL_MS = 30_000;

interface ErrorEntry {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  timestamp: number;
  userAgent: string;
}

const buffer: ErrorEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, BUFFER_MAX);

  // Send via beacon so it survives page unloads
  const endpoint = "/api/errors";
  const payload = JSON.stringify({ errors: batch });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
  } else {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // silently drop — we're the error reporter, we can't recurse
    });
  }
}

export function reportError(
  error: Error | string,
  componentStack?: string,
) {
  const err = typeof error === "string" ? new Error(error) : error;

  const entry: ErrorEntry = {
    message: err.message,
    stack: err.stack?.slice(0, 2000),
    componentStack: componentStack?.slice(0, 1000),
    url: typeof window !== "undefined" ? window.location.href : "",
    timestamp: Date.now(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  buffer.push(entry);

  if (buffer.length >= BUFFER_MAX) {
    flush();
  } else {
    scheduleFlush();
  }
}

/** Install global handlers for uncaught errors and unhandled rejections. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      reportError(reason);
    } else {
      reportError(String(reason));
    }
  });

  // Flush on page hide (tab close / navigate away)
  window.addEventListener("pagehide", flush);
}
