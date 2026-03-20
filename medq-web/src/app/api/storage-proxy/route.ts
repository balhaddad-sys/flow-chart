import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "medq-a6cc6.firebasestorage.app",
  "storage.googleapis.com",
]);
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024; // 50 MB limit for PDFs

/**
 * Server-side proxy for Firebase Storage downloads.
 * Avoids CORS issues since the fetch happens on the server, not the browser.
 * Streams binary data (PDFs, images) with proper content types.
 */
export async function GET(req: NextRequest) {
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

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from storage" }, { status: 502 });
  }
}
