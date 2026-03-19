import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "medq-a6cc6.firebasestorage.app",
  "storage.googleapis.com",
]);
const MAX_SECTION_PAGES = 60;
const MAX_SOURCE_BYTES = 100 * 1024 * 1024; // 100 MB source PDF limit

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function safeName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "section";
  return trimmed.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

/**
 * Builds a section-only PDF so users see the exact page range for that section
 * instead of opening the full source document.
 */
export async function GET(req: NextRequest) {
  // Auth check — supports both header and query param (for window.open use cases)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
    : req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // verifyFirebaseToken expects "Bearer <token>" format
  const bearerToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const user = await verifyFirebaseToken(bearerToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return NextResponse.json({ error: `URL host not allowed: ${parsedUrl.hostname}` }, { status: 403 });
  }

  const requestedStart = toPositiveInt(req.nextUrl.searchParams.get("start"), 1);
  const requestedEnd = toPositiveInt(req.nextUrl.searchParams.get("end"), requestedStart);
  const desiredStart = Math.min(requestedStart, requestedEnd);
  const desiredEnd = Math.max(requestedStart, requestedEnd);
  const requestedName = safeName(req.nextUrl.searchParams.get("name") || "section");

  try {
    const sourceRes = await fetch(rawUrl);
    if (!sourceRes.ok) {
      return NextResponse.json(
        { error: `Storage returned ${sourceRes.status}` },
        { status: sourceRes.status }
      );
    }

    const sourceBytes = await sourceRes.arrayBuffer();
    if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "Source PDF too large" }, { status: 413 });
    }
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const totalPages = sourcePdf.getPageCount();

    if (totalPages === 0) {
      return NextResponse.json({ error: "Source PDF has no pages" }, { status: 400 });
    }

    const startPage = Math.max(1, Math.min(desiredStart, totalPages));
    const boundedEnd = Math.max(startPage, Math.min(desiredEnd, totalPages));
    const endPage = Math.min(startPage + MAX_SECTION_PAGES - 1, boundedEnd);

    const pageIndexes = Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage - 1 + i
    );

    const sectionPdf = await PDFDocument.create();
    const copiedPages = await sectionPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => sectionPdf.addPage(page));
    const outputBytes = await sectionPdf.save();

    return new NextResponse(Buffer.from(outputBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${requestedName}_p${startPage}-${endPage}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to build section PDF" },
      { status: 502 }
    );
  }
}
