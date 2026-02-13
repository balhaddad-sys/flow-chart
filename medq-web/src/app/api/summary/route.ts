import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const MODEL_ID = "gemini-2.0-flash";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
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

    // Extract JSON from response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } else {
        throw new Error("Could not parse Gemini response as JSON");
      }
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
