import { NextResponse } from "next/server";

/**
 * Lightweight health-check used by the Flutter app to detect whether the
 * Vercel proxy is reachable before entering proxy mode.
 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
