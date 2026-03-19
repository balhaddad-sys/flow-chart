/**
 * Lightweight funnel event tracker for MedQ.
 *
 * Tracks the core user journey:
 *   signup → onboarding_complete → first_upload → first_study → first_quiz → return_visit
 *
 * Events are sent to the /api/errors endpoint (repurposed as event collector)
 * and to console in development. In production, these can be forwarded to
 * any analytics backend (Mixpanel, Amplitude, PostHog, etc.)
 */

type FunnelEvent =
  | "signup"
  | "onboarding_start"
  | "onboarding_complete"
  | "first_upload"
  | "upload_complete"
  | "first_study_session"
  | "study_session_complete"
  | "first_quiz"
  | "quiz_complete"
  | "first_ai_chat"
  | "plan_generated"
  | "return_visit";

interface EventPayload {
  event: FunnelEvent;
  properties?: Record<string, string | number | boolean>;
  timestamp: string;
  sessionId: string;
}

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("medq_session_id");
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem("medq_session_id", sessionId);
    }
  } catch {
    sessionId = `s_${Date.now()}`;
  }
  return sessionId;
}

const trackedThisSession = new Set<FunnelEvent>();

/**
 * Track a funnel event. Each event type is only sent once per session
 * to avoid noise from re-renders or page revisits.
 */
export function trackFunnelEvent(
  event: FunnelEvent,
  properties?: Record<string, string | number | boolean>
) {
  if (trackedThisSession.has(event)) return;
  trackedThisSession.add(event);

  const payload: EventPayload = {
    event,
    properties,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[funnel]", event, properties ?? "");
    return;
  }

  // Fire-and-forget — never block the UI
  try {
    if (typeof navigator?.sendBeacon === "function") {
      navigator.sendBeacon(
        "/api/errors",
        JSON.stringify({ type: "funnel_event", ...payload })
      );
    } else {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "funnel_event", ...payload }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silent failure — analytics should never break the app
  }
}

/**
 * Track a milestone that the user has reached for the first time.
 * Uses localStorage to persist across sessions.
 */
export function trackMilestone(event: FunnelEvent, properties?: Record<string, string | number | boolean>) {
  try {
    const key = `medq_milestone_${event}`;
    if (localStorage.getItem(key)) return; // already tracked
    localStorage.setItem(key, new Date().toISOString());
    trackFunnelEvent(event, properties);
  } catch {
    trackFunnelEvent(event, properties);
  }
}
