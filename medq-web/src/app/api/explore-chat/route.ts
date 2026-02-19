import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";
import {
  buildExploreTutorSystemPrompt,
  chooseExploreChatProvider,
  normalizeExploreLevel,
  type ExploreChatProvider,
} from "@/lib/utils/explore-chat-policy";

const GEMINI_MODEL_ID = "gemini-2.0-flash";
const CLAUDE_HAIKU_MODEL_ID = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const MAX_CONTEXT_CHARS = 2_000;
const MAX_HISTORY = 6;
const MAX_TOPIC_CHARS = 120;
const MAX_MESSAGE_CHARS = 2_000;
const GEMINI_TIMEOUT_MS = 20_000;
const CLAUDE_TIMEOUT_MS = 22_000;

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

interface ModelResponse {
  response: string;
  provider: ExploreChatProvider;
  modelUsed: string;
}

interface ProviderResolution {
  provider: ExploreChatProvider;
  modelUsed: string;
  fallbackReason: string | null;
}

const rateLimitMap = new Map<string, number[]>();
const responseCache = new Map<string, ResponseCacheEntry>();
const inFlightResponses = new Map<string, Promise<ModelResponse>>();

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

function buildContextString(context: Record<string, unknown>): string {
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

  return contextParts.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

function resolveProvider({
  preferredProvider,
  hasGeminiKey,
  hasAnthropicKey,
}: {
  preferredProvider: ExploreChatProvider;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
}): ProviderResolution | null {
  if (preferredProvider === "claude-haiku") {
    if (hasAnthropicKey) {
      return {
        provider: "claude-haiku",
        modelUsed: CLAUDE_HAIKU_MODEL_ID,
        fallbackReason: null,
      };
    }
    if (hasGeminiKey) {
      return {
        provider: "gemini",
        modelUsed: GEMINI_MODEL_ID,
        fallbackReason: "ANTHROPIC_API_KEY missing; used Gemini fallback.",
      };
    }
    return null;
  }

  if (hasGeminiKey) {
    return {
      provider: "gemini",
      modelUsed: GEMINI_MODEL_ID,
      fallbackReason: null,
    };
  }

  if (hasAnthropicKey) {
    return {
      provider: "claude-haiku",
      modelUsed: CLAUDE_HAIKU_MODEL_ID,
      fallbackReason: "GEMINI_API_KEY missing; used Claude Haiku fallback.",
    };
  }

  return null;
}

async function callGemini({
  apiKey,
  systemPrompt,
  historyMessages,
  message,
}: {
  apiKey: string;
  systemPrompt: string;
  historyMessages: NormalizedHistoryItem[];
  message: string;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_ID,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
  });

  const contents = [
    ...historyMessages.map((item) => ({
      role: item.role,
      parts: [{ text: item.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  return withTimeout(
    model
      .generateContent({
        systemInstruction: systemPrompt,
        contents,
      })
      .then((result) => result.response.text().trim()),
    GEMINI_TIMEOUT_MS,
    "AI response timed out. Please retry."
  );
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: unknown }).name === "AbortError";
}

async function callClaudeHaiku({
  apiKey,
  systemPrompt,
  historyMessages,
  message,
}: {
  apiKey: string;
  systemPrompt: string;
  historyMessages: NormalizedHistoryItem[];
  message: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  try {
    const messages = [
      ...historyMessages.map((item) => ({
        role: item.role === "user" ? "user" : "assistant",
        content: item.text,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU_MODEL_ID,
        system: systemPrompt,
        max_tokens: 1024,
        temperature: 0.3,
        messages,
      }),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      throw new Error(
        payload?.error?.message || `Anthropic API request failed (${res.status}).`
      );
    }

    const responseText = Array.isArray(payload?.content)
      ? payload.content
          .filter((block) => block?.type === "text" && typeof block.text === "string")
          .map((block) => block.text as string)
          .join("")
          .trim()
      : "";

    return responseText;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI response timed out. Please retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const messageRaw = typeof body.message === "string" ? body.message.trim() : "";

  if (!topicRaw || !messageRaw) {
    return NextResponse.json(
      { success: false, error: "message and topic are required" },
      { status: 400 }
    );
  }

  const topic = topicRaw.slice(0, MAX_TOPIC_CHARS);
  const message = messageRaw.slice(0, MAX_MESSAGE_CHARS);
  const levelProfile = normalizeExploreLevel(body.level);
  const context = (body.context ?? {}) as Record<string, unknown>;
  const contextStr = buildContextString(context);
  const historyMessages = normalizeHistory(body.history);

  const routingDecision = chooseExploreChatProvider({ topic, message });
  const highSensitivityMode = routingDecision.provider === "claude-haiku";

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const providerResolution = resolveProvider({
    preferredProvider: routingDecision.provider,
    hasGeminiKey: Boolean(geminiApiKey),
    hasAnthropicKey: Boolean(anthropicApiKey),
  });

  if (!providerResolution) {
    return NextResponse.json(
      {
        success: false,
        error: "No AI provider key configured. Set GEMINI_API_KEY and/or ANTHROPIC_API_KEY.",
      },
      { status: 503 }
    );
  }

  const systemPrompt = buildExploreTutorSystemPrompt({
    topic,
    levelProfile,
    contextText: contextStr,
    highSensitivityMode,
  });

  const cacheSource = JSON.stringify({
    uid: user.uid,
    topic,
    level: levelProfile.id,
    message,
    context: contextStr,
    history: historyMessages,
    provider: providerResolution.provider,
    model: providerResolution.modelUsed,
    policyVersion: "v2",
  });

  const cacheKey = `${user.uid}:${quickHash(cacheSource)}`;
  const cachedResponse = readResponseCache(cacheKey);
  if (cachedResponse) {
    return NextResponse.json({
      success: true,
      data: {
        response: cachedResponse,
        cached: true,
        provider: providerResolution.provider,
        modelUsed: providerResolution.modelUsed,
        level: levelProfile.id,
        levelLabel: levelProfile.label,
        routingReason: routingDecision.reason,
        providerFallback: providerResolution.fallbackReason,
      },
    });
  }

  let responsePromise = inFlightResponses.get(cacheKey);
  if (!responsePromise) {
    if (providerResolution.provider === "claude-haiku") {
      if (!anthropicApiKey) {
        return NextResponse.json(
          { success: false, error: "Anthropic API key is not configured." },
          { status: 503 }
        );
      }

      responsePromise = callClaudeHaiku({
        apiKey: anthropicApiKey,
        systemPrompt,
        historyMessages,
        message,
      }).then((response) => ({
        response,
        provider: providerResolution.provider,
        modelUsed: providerResolution.modelUsed,
      }));
    } else {
      if (!geminiApiKey) {
        return NextResponse.json(
          { success: false, error: "Gemini API key is not configured." },
          { status: 503 }
        );
      }

      responsePromise = callGemini({
        apiKey: geminiApiKey,
        systemPrompt,
        historyMessages,
        message,
      }).then((response) => ({
        response,
        provider: providerResolution.provider,
        modelUsed: providerResolution.modelUsed,
      }));
    }

    inFlightResponses.set(cacheKey, responsePromise);
  }

  try {
    const modelResponse = await responsePromise;
    const response = modelResponse.response.trim();
    if (!response) {
      throw new Error("AI returned an empty response.");
    }

    writeResponseCache(cacheKey, response);
    return NextResponse.json({
      success: true,
      data: {
        response,
        cached: false,
        provider: modelResponse.provider,
        modelUsed: modelResponse.modelUsed,
        level: levelProfile.id,
        levelLabel: levelProfile.label,
        routingReason: routingDecision.reason,
        providerFallback: providerResolution.fallbackReason,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate response";
    const normalized = message.toLowerCase();
    const status =
      normalized.includes("timed out") || normalized.includes("timeout")
        ? 504
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    inFlightResponses.delete(cacheKey);
  }
}
