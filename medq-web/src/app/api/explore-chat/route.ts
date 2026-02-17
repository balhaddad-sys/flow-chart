import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const MODEL_ID = "gemini-2.0-flash";
const MAX_CONTEXT_CHARS = 2_000;
const MAX_HISTORY = 6;
const MAX_TOPIC_CHARS = 120;
const MAX_MESSAGE_CHARS = 2_000;
const MODEL_TIMEOUT_MS = 20_000;

const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

const RESPONSE_CACHE_TTL_MS = 120_000;
const RESPONSE_CACHE_MAX_ENTRIES = 256;

type NormalizedHistoryItem = {
  role: "user" | "model";
  text: string;
};

interface ResponseCacheEntry {
  value: string;
  expiresAt: number;
}

const rateLimitMap = new Map<string, number[]>();
const responseCache = new Map<string, ResponseCacheEntry>();
const inFlightResponses = new Map<string, Promise<string>>();

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

function trimResponseCache() {
  if (responseCache.size <= RESPONSE_CACHE_MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }

  while (responseCache.size > RESPONSE_CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    responseCache.delete(oldestKey);
  }
}

function readResponseCache(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeResponseCache(key: string, value: string) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
  });
  trimResponseCache();
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

function toStringArray(
  value: unknown,
  maxItems: number,
  maxCharsPerItem: number
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => String(item ?? "").trim().slice(0, maxCharsPerItem))
    .filter(Boolean);
}

function normalizeHistory(value: unknown): NormalizedHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY)
    .map((item) => {
      const raw = item as { role?: unknown; content?: unknown };
      const role = raw.role === "user" ? "user" : "model";
      const text = String(raw.content ?? "").trim().slice(0, 1000);
      return text ? { role, text } : null;
    })
    .filter((item): item is NormalizedHistoryItem => item != null);
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

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const topicRaw = typeof body.topic === "string" ? body.topic.trim() : "";
  const messageRaw =
    typeof body.message === "string" ? body.message.trim() : "";

  if (!topicRaw || !messageRaw) {
    return NextResponse.json(
      { success: false, error: "message and topic are required" },
      { status: 400 }
    );
  }

  const topic = topicRaw.slice(0, MAX_TOPIC_CHARS);
  const message = messageRaw.slice(0, MAX_MESSAGE_CHARS);
  const level =
    typeof body.level === "string" ? body.level.trim().slice(0, 48) : "general";

  const context = (body.context ?? {}) as Record<string, unknown>;
  const contextParts: string[] = [];

  if (typeof context.summary === "string" && context.summary.trim()) {
    contextParts.push(`Summary: ${context.summary.trim()}`);
  }

  const corePoints = toStringArray(context.corePoints, 5, 220);
  if (corePoints.length > 0) {
    contextParts.push(`Core points: ${corePoints.join("; ")}`);
  }

  const sectionTitles = toStringArray(context.sectionTitles, 8, 120);
  if (sectionTitles.length > 0) {
    contextParts.push(`Sections covered: ${sectionTitles.join(", ")}`);
  }

  const contextStr = contextParts.join("\n").slice(0, MAX_CONTEXT_CHARS);
  const historyMessages = normalizeHistory(body.history);

  const cacheSource = JSON.stringify({
    uid: user.uid,
    topic,
    level,
    message,
    context: contextStr,
    history: historyMessages,
  });
  const cacheKey = `${user.uid}:${quickHash(cacheSource)}`;
  const cachedResponse = readResponseCache(cacheKey);
  if (cachedResponse) {
    return NextResponse.json({
      success: true,
      data: { response: cachedResponse, cached: true },
    });
  }

  const systemPrompt = `You are MedQ Explore Tutor, an expert medical education assistant.
The student is studying: "${topic}" at level ${level || "general"}.

${contextStr}

Rules:
- Answer questions specifically about this medical topic.
- Be accurate, evidence-based, and clinically oriented.
- If the student asks something outside this topic, briefly redirect.
- Keep answers concise (3-6 sentences) unless the student asks for more detail.
- This is for education only, not clinical advice.`;

  const contents = [
    ...historyMessages.map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  let responsePromise = inFlightResponses.get(cacheKey);
  if (!responsePromise) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
    });

    responsePromise = withTimeout(
      model
        .generateContent({
          systemInstruction: systemPrompt,
          contents,
        })
        .then((result) => result.response.text().trim()),
      MODEL_TIMEOUT_MS,
      "AI response timed out. Please retry."
    );
    inFlightResponses.set(cacheKey, responsePromise);
  }

  try {
    const response = await responsePromise;
    if (!response) {
      throw new Error("AI returned an empty response.");
    }

    writeResponseCache(cacheKey, response);
    return NextResponse.json({
      success: true,
      data: { response, cached: false },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate response";
    const status = message.toLowerCase().includes("timed out") ? 504 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  } finally {
    inFlightResponses.delete(cacheKey);
  }
}
