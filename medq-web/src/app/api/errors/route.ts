import { NextResponse } from "next/server";

/**
 * POST /api/errors — receives batched client-side error reports.
 *
 * In production this logs to stdout (picked up by Vercel / Cloud Logging).
 * Swap for Sentry relay, Datadog, or any APM backend when ready.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const errors = body?.errors;

    if (!Array.isArray(errors) || errors.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    for (const entry of errors.slice(0, 10)) {
      console.error("[CLIENT_ERROR]", {
        message: entry.message,
        url: entry.url,
        timestamp: entry.timestamp,
        stack: entry.stack?.slice(0, 500),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
