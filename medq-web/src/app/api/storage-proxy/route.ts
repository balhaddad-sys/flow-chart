import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOST = "firebasestorage.googleapis.com";

/**
 * Server-side proxy for Firebase Storage downloads.
 * Avoids CORS issues since the fetch happens on the server, not the browser.
 */
export async function GET(req: NextRequest) {
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

  if (parsed.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Storage returned ${res.status}` },
        { status: res.status }
      );
    }
    const text = await res.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch from storage" }, { status: 502 });
  }
}
