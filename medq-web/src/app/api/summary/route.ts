import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

const MODEL_ID = "gemini-2.0-flash";
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "medq-a6cc6";

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

/**
 * Verify a Firebase ID token cryptographically using Google's rotating
 * public certificates (RS256). Validates kid, alg, signature, issuer,
 * audience, and expiry.
 */
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

    // Claim validation
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

    // Signature verification against Google's public certs
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
      sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer,
      new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
    );

    return valid ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}

/* ── JSON extraction ─────────────────────────────────────────────────── */
function extractJson(text: string) {
  const parse = (v: string) => {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  const raw = parse(text);
  if (raw) return raw;

  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const cleanedParsed = parse(cleaned);
  if (cleanedParsed) return cleanedParsed;

  try {
    return JSON.parse(jsonrepair(cleaned));
  } catch {
    // continue
  }

  const start = Math.min(
    cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
    cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("[")
  );
  if (start === Infinity) throw new Error("Could not parse model output as JSON.");

  const isArray = cleaned[start] === "[";
  const end = cleaned.lastIndexOf(isArray ? "]" : "}");
  if (end <= start) throw new Error("Malformed JSON in model output.");

  const sliced = cleaned.slice(start, end + 1);
  return parse(sliced) ?? JSON.parse(jsonrepair(sliced));
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Summary API key is not configured. Use the Firebase callable endpoint.",
      },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { sectionText, title } = body;

  if (!sectionText || !title) {
    return NextResponse.json(
      { error: "sectionText and title are required" },
      { status: 400 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
  });

  const systemPrompt = `You are MedQ Summarizer. Create concise, exam-focused summaries of medical study material.
Output STRICT JSON only. No markdown, no commentary, no code fences.`;

  const userPrompt = `Section: "${title}"

Text:
"""
${sectionText.slice(0, 8000)}
"""

Return this exact JSON schema:
{
  "summary": "string — 2-3 sentence overview",
  "keyPoints": ["string — 4-6 bullet points of the most important facts"],
  "mnemonics": ["string — 0-2 memory aids if applicable"]
}`;

  try {
    const result = await model.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const text = result.response.text();
    const parsed = extractJson(text);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini API error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
