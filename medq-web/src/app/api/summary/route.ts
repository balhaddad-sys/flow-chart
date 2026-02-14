import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

const MODEL_ID = "gemini-2.0-flash";

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
