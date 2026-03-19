import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_MODEL = "imagen-3.0-generate-002";
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;
const TIMEOUT_MS = 30_000;

// Simple in-memory cache for generated images
const IMAGE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const IMAGE_CACHE_MAX = 32;

interface CacheEntry {
  base64: string;
  mimeType: string;
  expiresAt: number;
}

const imageCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

function trimCache() {
  if (imageCache.size <= IMAGE_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, entry] of imageCache.entries()) {
    if (entry.expiresAt <= now) imageCache.delete(key);
  }
  while (imageCache.size > IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value as string | undefined;
    if (!oldest) break;
    imageCache.delete(oldest);
  }
}

function quickHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

// Rate limit: max 3 image generations per user per minute
const userRateMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const timestamps = (userRateMap.get(uid) ?? []).filter(
    (t) => t > now - RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  userRateMap.set(uid, timestamps);
  return true;
}

async function generateImage(prompt: string): Promise<CacheEntry> {
  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "16:9",
      personGeneration: "DONT_ALLOW",
      safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${IMAGEN_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Imagen API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as {
      predictions?: Array<{
        bytesBase64Encoded: string;
        mimeType?: string;
      }>;
    };

    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error("No image generated. The content may have been filtered for safety.");
    }

    return {
      base64: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType ?? "image/png",
      expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a detailed, safe image prompt for medical education.
 * Avoids generating photos of real people or graphic medical content.
 */
function buildImagePrompt(topic: string, context: string, style: string): string {
  const styleMap: Record<string, string> = {
    diagram:
      "Clean, professional medical textbook diagram style. Labeled anatomical or biochemical illustration with clear annotations, white background, precise lines, muted clinical color palette.",
    infographic:
      "Modern medical infographic style. Flat design with icons, clean typography, organized sections, teal and blue color scheme, professional healthcare aesthetic.",
    concept:
      "Educational concept illustration for medical students. Abstract scientific visualization, molecular or cellular level, clean vector art style, labeled components, light background.",
    clinical:
      "Clinical reference card style. Structured layout with key information, flowchart elements, color-coded sections, professional medical publishing aesthetic. No photographs.",
  };

  const styleDesc = styleMap[style] ?? styleMap.diagram;

  return `${styleDesc}

Topic: ${topic}
${context ? `Context: ${context}` : ""}

Requirements:
- Educational medical illustration suitable for a medical textbook
- Clear labels and annotations where appropriate
- Professional, clean, and accurate
- No photographs of real people
- No graphic surgical or wound content
- Suitable for medical student study materials`;
}

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Image generation API not configured." },
      { status: 503 }
    );
  }

  if (!checkRateLimit(user.uid)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait a minute before generating more images." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 200) : "";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 500) : "";
  const style = typeof body.style === "string" ? body.style : "diagram";

  if (!topic) {
    return NextResponse.json({ success: false, error: "topic is required." }, { status: 400 });
  }

  const prompt = buildImagePrompt(topic, context, style);
  const cacheKey = `img:${user.uid}:${quickHash(prompt)}`;

  // Check cache
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      success: true,
      data: { base64: cached.base64, mimeType: cached.mimeType },
      cached: true,
    });
  }

  // Deduplicate in-flight
  let promise = inFlight.get(cacheKey);
  if (!promise) {
    promise = generateImage(prompt);
    inFlight.set(cacheKey, promise);
  }

  try {
    const result = await promise;
    imageCache.set(cacheKey, result);
    trimCache();
    return NextResponse.json({
      success: true,
      data: { base64: result.base64, mimeType: result.mimeType },
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    const status = message.includes("timed out") || message.includes("abort") ? 504 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    inFlight.delete(cacheKey);
  }
}
