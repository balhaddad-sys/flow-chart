import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const MODEL_ID = "gemini-2.0-flash";
const MODEL_TIMEOUT_MS = 30_000;
const INPUT_TITLE_MAX_CHARS = 180;
const INPUT_SECTION_MAX_CHARS = 20_000;
const PROMPT_SECTION_MAX_CHARS = 8_000;

const SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000;
const SUMMARY_CACHE_MAX_ENTRIES = 128;

interface SummaryCacheEntry {
  value: Record<string, unknown>;
  expiresAt: number;
}

const summaryCache = new Map<string, SummaryCacheEntry>();
const inFlightSummaries = new Map<string, Promise<Record<string, unknown>>>();

function trimSummaryCache() {
  if (summaryCache.size <= SUMMARY_CACHE_MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of summaryCache.entries()) {
    if (entry.expiresAt <= now) {
      summaryCache.delete(key);
    }
  }

  while (summaryCache.size > SUMMARY_CACHE_MAX_ENTRIES) {
    const oldestKey = summaryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    summaryCache.delete(oldestKey);
  }
}

function readSummaryCache(key: string): Record<string, unknown> | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    summaryCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeSummaryCache(key: string, value: Record<string, unknown>) {
  summaryCache.set(key, {
    value,
    expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
  });
  trimSummaryCache();
}

function quickHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function parseJsonSafe(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> {
  const raw = parseJsonSafe(text);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const cleanedParsed = parseJsonSafe(cleaned);
  if (
    cleanedParsed &&
    typeof cleanedParsed === "object" &&
    !Array.isArray(cleanedParsed)
  ) {
    return cleanedParsed as Record<string, unknown>;
  }

  try {
    const repaired = JSON.parse(jsonrepair(cleaned)) as unknown;
    if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) {
      return repaired as Record<string, unknown>;
    }
  } catch {
    // Continue to bracket extraction fallback
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Could not parse model output as JSON.");
  }

  const sliced = cleaned.slice(start, end + 1);
  const slicedParsed = parseJsonSafe(sliced);
  if (slicedParsed && typeof slicedParsed === "object" && !Array.isArray(slicedParsed)) {
    return slicedParsed as Record<string, unknown>;
  }

  const repairedSliced = JSON.parse(jsonrepair(sliced)) as unknown;
  if (
    repairedSliced &&
    typeof repairedSliced === "object" &&
    !Array.isArray(repairedSliced)
  ) {
    return repairedSliced as Record<string, unknown>;
  }

  throw new Error("Model output was not valid JSON object.");
}

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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  const sectionTextRaw =
    typeof body.sectionText === "string" ? body.sectionText.trim() : "";

  if (!titleRaw || !sectionTextRaw) {
    return NextResponse.json(
      { success: false, error: "sectionText and title are required" },
      { status: 400 }
    );
  }

  const title = titleRaw.slice(0, INPUT_TITLE_MAX_CHARS);
  const sectionText = sectionTextRaw.slice(0, INPUT_SECTION_MAX_CHARS);
  const promptSectionText = sectionText.slice(0, PROMPT_SECTION_MAX_CHARS);

  const cacheKey = `${user.uid}:${quickHash(
    `${title}::${sectionText.length}::${sectionText}`
  )}`;
  const cached = readSummaryCache(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, cached: true });
  }

  let summaryPromise = inFlightSummaries.get(cacheKey);
  if (!summaryPromise) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
    });

    const systemPrompt = `You are MedQ Summarizer. Create thoughtful, exam-focused medical study notes.
Prioritize mechanism-level understanding, clinical interpretation, and decision points.
Output STRICT JSON only. No markdown, no commentary, no code fences.`;

    const userPrompt = `Section: "${title}"

Text:
"""
${promptSectionText}
"""

Return this exact JSON schema:
{
  "summary": "string — 4-6 sentence synthesis linking mechanism, diagnostic clues, and management priorities",
  "keyPoints": ["string — 6-8 high-yield points with decisive clinical details"],
  "mnemonics": ["string — 0-3 concise memory aids if applicable"]
}`;

    summaryPromise = withTimeout(
      model
        .generateContent({
          systemInstruction: systemPrompt,
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        })
        .then((result) => extractJson(result.response.text())),
      MODEL_TIMEOUT_MS,
      "Summary generation timed out. Please retry."
    );
    inFlightSummaries.set(cacheKey, summaryPromise);
  }

  try {
    const parsed = await summaryPromise;
    writeSummaryCache(cacheKey, parsed);
    return NextResponse.json({ success: true, data: parsed, cached: false });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini API error";
    const status = message.toLowerCase().includes("timed out") ? 504 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  } finally {
    inFlightSummaries.delete(cacheKey);
  }
}
