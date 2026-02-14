import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

const MODEL_ID = "gemini-2.0-flash";
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "medq-a6cc6";

/**
 * Lightweight Firebase ID token verification.
 * Decodes the JWT and validates issuer, audience, and expiry.
 * For full cryptographic verification, firebase-admin would be needed.
 */
function verifyFirebaseToken(authHeader: string | null): { uid: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      payload.aud !== FIREBASE_PROJECT_ID ||
      !payload.sub ||
      typeof payload.sub !== "string" ||
      (payload.exp && payload.exp < now)
    ) {
      return null;
    }

    return { uid: payload.sub };
  } catch {
    return null;
  }
}

function extractJson(text: string) {
  const parse = (value: string) => {
    try {
      return JSON.parse(value);
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
  if (start === Infinity) {
    throw new Error("Could not parse model output as JSON.");
  }
  const isArray = cleaned[start] === "[";
  const end = cleaned.lastIndexOf(isArray ? "]" : "}");
  if (end <= start) {
    throw new Error("Malformed JSON in model output.");
  }

  const sliced = cleaned.slice(start, end + 1);
  const slicedParsed = parse(sliced);
  if (slicedParsed) return slicedParsed;

  return JSON.parse(jsonrepair(sliced));
}

export async function POST(req: NextRequest) {
  // Auth guard: require valid Firebase ID token
  const user = verifyFirebaseToken(req.headers.get("authorization"));
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
          "Summary API key is not configured for the web server. Use the Firebase callable summary endpoint.",
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
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3,
    },
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
    const message = error instanceof Error ? error.message : "Gemini API error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
