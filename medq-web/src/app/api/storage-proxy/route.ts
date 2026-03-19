import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "medq-a6cc6.firebasestorage.app",
  "storage.googleapis.com",
]);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB limit

/**
 * Server-side proxy for Firebase Storage downloads.
 * Avoids CORS issues since the fetch happens on the server, not the browser.
 *
 * Security:
 * - Requires valid Firebase auth token
 * - Only allows firebasestorage.googleapis.com URLs (SSRF protection)
 * - Enforces response size limit
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const bearerToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const user = await verifyFirebaseToken(bearerToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate the URL points to Firebase Storage (prevent SSRF)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: `URL host not allowed: ${parsed.hostname}` }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Storage returned ${res.status}` },
        { status: res.status }
      );
    }

    // Enforce size limit
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from storage" }, { status: 502 });
  }
}
