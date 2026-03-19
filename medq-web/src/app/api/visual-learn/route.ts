import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import { verifyFirebaseToken } from "@/lib/server/firebase-token";

const MODEL_ID = "gemini-2.5-flash-lite";
const MODEL_TIMEOUT_MS = 30_000;
const INPUT_TITLE_MAX_CHARS = 180;
const INPUT_SECTION_MAX_CHARS = 8_000;
const PROMPT_SECTION_MAX_CHARS = 4_000;

const VISUAL_CACHE_TTL_MS = 15 * 60 * 1000;
const VISUAL_CACHE_MAX_ENTRIES = 64;

interface CacheEntry {
  value: Record<string, unknown>;
  expiresAt: number;
}

const visualCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<Record<string, unknown>>>();

function trimCache() {
  if (visualCache.size <= VISUAL_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of visualCache.entries()) {
    if (entry.expiresAt <= now) visualCache.delete(key);
  }
  while (visualCache.size > VISUAL_CACHE_MAX_ENTRIES) {
    const oldestKey = visualCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    visualCache.delete(oldestKey);
  }
}

function readCache(key: string): Record<string, unknown> | null {
  const entry = visualCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    visualCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: Record<string, unknown>) {
  visualCache.set(key, { value, expiresAt: Date.now() + VISUAL_CACHE_TTL_MS });
  trimCache();
}

function quickHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function extractJson(text: string): Record<string, unknown> {
  const tryParse = (v: string) => {
    try {
      const r = JSON.parse(v);
      return r && typeof r === "object" && !Array.isArray(r) ? r : null;
    } catch { return null; }
  };

  let result = tryParse(text);
  if (result) return result;

  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  result = tryParse(cleaned);
  if (result) return result;

  try {
    result = tryParse(jsonrepair(cleaned));
    if (result) return result;
  } catch { /* continue */ }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = cleaned.slice(start, end + 1);
    result = tryParse(sliced);
    if (result) return result;
    try {
      result = tryParse(jsonrepair(sliced));
      if (result) return result;
    } catch { /* continue */ }
  }

  throw new Error("Could not parse model output as JSON.");
}

const SYSTEM_PROMPT = `You are MedQ Visual Learning Designer. Your job is to create structured visual learning aids for medical education. You produce data that will be rendered as interactive diagrams, not prose.

Rules:
- Output STRICT JSON only. No markdown, no commentary, no code fences.
- Every visual must be medically accurate and exam-relevant.
- Use precise medical terminology.
- Keep labels concise (2-6 words each).
- Colors should use semantic meaning: blue=normal/anatomy, red=pathology/danger, green=treatment/positive, orange=warning/caution, purple=mechanism/pathway.`;

const USER_PROMPT = (title: string, text: string, concepts: string[], topicTags: string[]) => `Section: "${title}"
${topicTags.length > 0 ? `Topics: ${topicTags.join(", ")}` : ""}
${concepts.length > 0 ? `Key Concepts: ${concepts.join(", ")}` : ""}

Source text:
"""
${text}
"""

Analyze this medical content and create 2-4 visual learning aids. Pick the BEST visualization types for this specific content from:

1. "concept_map" — nodes and labeled edges showing relationships between concepts
2. "process_flow" — sequential steps in a pathway, algorithm, or mechanism
3. "comparison_table" — side-by-side comparison of related items (diseases, drugs, etc.)
4. "hierarchy" — tree/classification structure (taxonomies, anatomical divisions)
5. "timeline" — chronological sequence (disease progression, treatment phases)

Return this JSON schema:
{
  "visuals": [
    {
      "type": "concept_map",
      "title": "string — descriptive title",
      "description": "string — one sentence explaining what this diagram shows",
      "data": {
        "nodes": [
          { "id": "string", "label": "string", "category": "primary|secondary|tertiary", "color": "blue|red|green|orange|purple|gray" }
        ],
        "edges": [
          { "from": "string — node id", "to": "string — node id", "label": "string — relationship" }
        ]
      }
    },
    {
      "type": "process_flow",
      "title": "string",
      "description": "string",
      "data": {
        "steps": [
          { "id": "string", "label": "string", "detail": "string — brief explanation", "type": "start|step|decision|end", "color": "blue|red|green|orange|purple|gray" }
        ],
        "connections": [
          { "from": "string", "to": "string", "label": "string — optional condition/label" }
        ]
      }
    },
    {
      "type": "comparison_table",
      "title": "string",
      "description": "string",
      "data": {
        "columns": ["string — column headers (first is the row label)"],
        "rows": [
          ["string — cell values, one per column"]
        ],
        "highlights": [{ "row": 0, "col": 0, "color": "green|red|orange|blue" }]
      }
    },
    {
      "type": "hierarchy",
      "title": "string",
      "description": "string",
      "data": {
        "root": {
          "label": "string",
          "color": "blue|red|green|orange|purple|gray",
          "children": [
            {
              "label": "string",
              "color": "string",
              "children": []
            }
          ]
        }
      }
    },
    {
      "type": "timeline",
      "title": "string",
      "description": "string",
      "data": {
        "events": [
          { "label": "string", "detail": "string", "time": "string — time marker", "color": "blue|red|green|orange|purple|gray" }
        ]
      }
    }
  ]
}

Pick the 2-4 most useful visualization types for THIS content. Do NOT include types that don't fit well.`;

export async function POST(req: NextRequest) {
  const user = await verifyFirebaseToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "Visual learning API key not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const titleRaw = typeof body.title === "string" ? body.title.trim() : "";
  const sectionTextRaw = typeof body.sectionText === "string" ? body.sectionText.trim() : "";
  const concepts = Array.isArray(body.concepts) ? (body.concepts as string[]).filter(Boolean).slice(0, 20) : [];
  const topicTags = Array.isArray(body.topicTags) ? (body.topicTags as string[]).filter(Boolean).slice(0, 10) : [];

  if (!titleRaw || !sectionTextRaw) {
    return NextResponse.json({ success: false, error: "sectionText and title are required" }, { status: 400 });
  }

  const title = titleRaw.slice(0, INPUT_TITLE_MAX_CHARS);
  const sectionText = sectionTextRaw.slice(0, INPUT_SECTION_MAX_CHARS);
  const promptText = sectionText.slice(0, PROMPT_SECTION_MAX_CHARS);

  const cacheKey = `visual:${user.uid}:${quickHash(`${title}::${sectionText.length}::${sectionText}`)}`;
  const cached = readCache(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, data: cached, cached: true });
  }

  let promise = inFlightRequests.get(cacheKey);
  if (!promise) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
    });

    promise = withTimeout(
      model
        .generateContent({
          systemInstruction: SYSTEM_PROMPT,
          contents: [{ role: "user", parts: [{ text: USER_PROMPT(title, promptText, concepts, topicTags) }] }],
        })
        .then((result) => {
          const text = result.response.text();
          if (!text || text.trim().length === 0) {
            throw new Error("AI returned an empty response. The content may have been filtered.");
          }
          return extractJson(text);
        }),
      MODEL_TIMEOUT_MS,
      "Visual learning generation timed out. Please retry."
    );
    inFlightRequests.set(cacheKey, promise);
  }

  try {
    const parsed = await promise;
    writeCache(cacheKey, parsed);
    return NextResponse.json({ success: true, data: parsed, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation error";
    const status = message.toLowerCase().includes("timed out") ? 504 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
