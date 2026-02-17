import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const MODEL_ID = "gemini-2.0-flash";
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "medq-a6cc6";
const MAX_CONTEXT_CHARS = 2000;
const MAX_HISTORY = 6;

/* ── Firebase public key cache ──────────────────────────────────────── */
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certsCache: { keys: Record<string, string>; expiresAt: number } | null =
  null;

async function fetchPublicKeys(): Promise<Record<string, string>> {
  if (certsCache && Date.now() < certsCache.expiresAt) return certsCache.keys;

  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Firebase public keys");

  const keys = (await res.json()) as Record<string, string>;
  const cc = res.headers.get("cache-control") ?? "";
  const m = cc.match(/max-age=(\d+)/);
  const ttl = m ? parseInt(m[1], 10) * 1000 : 3_600_000;

  certsCache = { keys, expiresAt: Date.now() + ttl };
  return keys;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function base64urlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToSpki(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");
  const der = atob(b64);
  const bytes = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i++) bytes[i] = der.charCodeAt(i);
  return bytes.buffer.slice(0) as ArrayBuffer;
}

/* ── Token verification ──────────────────────────────────────────────── */
async function verifyFirebaseToken(
  authHeader: string | null
): Promise<{ uid: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const [rawHeader, rawPayload, rawSig] = token.split(".");
    if (!rawHeader || !rawPayload || !rawSig) return null;

    const header = JSON.parse(
      Buffer.from(rawHeader, "base64url").toString("utf-8")
    );
    const payload = JSON.parse(
      Buffer.from(rawPayload, "base64url").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "RS256" ||
      !header.kid ||
      payload.iss !==
        `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      payload.aud !== FIREBASE_PROJECT_ID ||
      !payload.sub ||
      typeof payload.sub !== "string" ||
      (payload.exp && payload.exp < now)
    ) {
      return null;
    }

    const certs = await fetchPublicKeys();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const key = await crypto.subtle.importKey(
      "spki",
      pemToSpki(certPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = base64urlDecode(rawSig);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sigBytes.buffer.slice(
        sigBytes.byteOffset,
        sigBytes.byteOffset + sigBytes.byteLength
      ) as ArrayBuffer,
      new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
    );

    return valid ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}

/* ── In-memory rate limiting ─────────────────────────────────────────── */
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const key = `explore-chat:${uid}`;
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return false;
  }

  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

/* ── Route handler ───────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!checkRateLimit(user.uid)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Chat API key is not configured." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { message, topic, level, context, history } = body;

  if (!message || typeof message !== "string" || !topic) {
    return NextResponse.json(
      { success: false, error: "message and topic are required" },
      { status: 400 }
    );
  }

  // Build compact context string capped at MAX_CONTEXT_CHARS
  const ctxParts: string[] = [];
  if (context?.summary) ctxParts.push(`Summary: ${context.summary}`);
  if (Array.isArray(context?.corePoints)) {
    ctxParts.push(`Core points: ${context.corePoints.slice(0, 5).join("; ")}`);
  }
  if (Array.isArray(context?.sectionTitles)) {
    ctxParts.push(
      `Sections covered: ${context.sectionTitles.slice(0, 8).join(", ")}`
    );
  }
  const contextStr = ctxParts.join("\n").slice(0, MAX_CONTEXT_CHARS);

  const systemPrompt = `You are MedQ Explore Tutor, an expert medical education assistant.
The student is studying: "${topic}" at level ${level || "general"}.

${contextStr}

Rules:
- Answer questions specifically about this medical topic.
- Be accurate, evidence-based, and clinically oriented.
- If the student asks something outside this topic, briefly redirect.
- Keep answers concise (3-6 sentences) unless the student asks for more detail.
- This is for education only, not clinical advice.`;

  // Build multi-turn conversation from history
  const historyMessages = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  const contents = [
    ...historyMessages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: String(msg.content || "").slice(0, 1000) }],
    })),
    { role: "user", parts: [{ text: message.slice(0, 2000) }] },
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
  });

  try {
    const result = await model.generateContent({
      systemInstruction: systemPrompt,
      contents,
    });

    const response = result.response.text();
    return NextResponse.json({ success: true, data: { response } });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate response";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
