/**
 * @module ai/prompts
 * @description System and user prompt templates for every AI-powered feature.
 *
 * All prompts enforce **strict JSON output** with exact field schemas so that
 * downstream code can parse responses without ambiguity.  Each prompt pair
 * consists of a constant system prompt and a builder function that assembles
 * the user message from runtime data.
 */

const BLUEPRINT_SYSTEM = `You are MedQ, a medical education content analyzer. Convert provided study
material into a structured topic blueprint for medical students.

CRITICAL — Ignore ALL of the following (these are OCR/extraction artifacts, NOT study content):
- Page numbers, headers, footers, timestamps (e.g. "Page 12", "5/13/04 12:59 PM")
- Author names, editor lists, publisher info, copyright notices
- ISBN, ISSN, DOI numbers, library cataloging data
- Table of contents, acknowledgments, preface text
- Book title repetitions, edition labels, cover text

Extract ONLY the actual medical/scientific educational content.
If the text contains no real educational content (e.g. it is just a title page, copyright page,
or table of contents), return empty arrays for all fields and set difficulty to 1.

Output STRICT JSON only. No markdown, no commentary, no code fences.`;

function blueprintUserPrompt({ fileName, sectionLabel, contentType, sectionText }) {
  return `File: "${fileName}"
Source label: "${sectionLabel}" (this is just a page/slide range — do NOT use it as the title)
Content type: "${contentType}"

Extracted text:
"""
${sectionText}
"""

Return this exact JSON schema:
{
  "title": "string — a descriptive topic-based title derived from the actual content (e.g. 'Neuronal Migration & Axon Guidance', 'Cardiac Electrophysiology'), NEVER use page numbers or file names",
  "learning_objectives": ["string — 3-6 objectives"],
  "key_concepts": ["string — the core concepts covered"],
  "high_yield_points": ["string — most exam-relevant facts"],
  "common_traps": ["string — common misconceptions or exam pitfalls"],
  "terms_to_define": ["string — medical terms students should know"],
  "difficulty": "integer 1-5",
  "estimated_minutes": "integer — realistic study time",
  "topic_tags": ["string — 2-5 medical topic tags for categorization"]
}`;
}

const QUESTIONS_SYSTEM = `You are MedQ Question Writer. Generate exam-style single-best-answer (SBA)
questions for medical students based on the provided topic blueprint.
Questions must be clinically relevant, unambiguous, and have exactly one
correct answer.
Every explanation must cite trusted medical sources (PubMed, UpToDate, Medscape).
Output STRICT JSON only.`;

function questionsUserPrompt({
  blueprintJSON,
  count,
  easyCount,
  mediumCount,
  hardCount,
  sectionTitle = "Unknown Section",
  sourceFileName = "Unknown File",
}) {
  return `Source file: "${sourceFileName}"
Section: "${sectionTitle}"

Topic blueprint (contains all learning objectives, key concepts, high-yield points, and terms):
${JSON.stringify(blueprintJSON)}

Generate exactly ${count} SBA questions with this difficulty distribution:
- ${easyCount} easy (difficulty 1-2)
- ${mediumCount} medium (difficulty 3)
- ${hardCount} hard (difficulty 4-5)

Quality rules:
- Every question must test a concrete concept from key_concepts, high_yield_points, or terms_to_define.
- Do not write generic stems; each stem must be specific to this section.
- Keep explanations concise and precise (1-2 sentences per field).
- Do not combine unrelated topics from different parts of the blueprint into one vague question.
- Each question must include 2-3 citations from trusted sources only: PubMed, UpToDate, Medscape.
- For each citation, provide the source name and a specific topic/article title (do NOT generate URLs).

Return this exact JSON schema:
{
  "questions": [
    {
      "stem": "string — clinical vignette or direct question",
      "options": ["string", "string", "string", "string", "string"],
      "correct_index": "integer 0-4",
      "difficulty": "integer 1-5",
      "tags": ["string — topic tags"],
      "explanation": {
        "correct_why": "string — why the correct answer is right",
        "why_others_wrong": [
          "string — why option A is wrong (or correct)",
          "string — why option B is wrong (or correct)",
          "string — why option C is wrong (or correct)",
          "string — why option D is wrong (or correct)",
          "string — why option E is wrong (or correct)"
        ],
        "key_takeaway": "string — the one thing to remember"
      },
      "source_ref": {
        "fileName": "string",
        "sectionLabel": "string — e.g., 'Slide 14' or 'Page 23'"
      },
      "citations": [
        {
          "source": "PUBMED | UPTODATE | MEDSCAPE",
          "title": "string — specific topic or article title for searching"
        }
      ]
    }
  ]
}`;
}

const TUTOR_SYSTEM = `You are MedQ Tutor. A medical student answered a question incorrectly.
Explain clearly and concisely. Be encouraging but accurate.
Output STRICT JSON only.`;

function tutorUserPrompt({ questionJSON, studentAnswerIndex, correctIndex }) {
  return `Question:
${JSON.stringify(questionJSON, null, 2)}

Student selected: option index ${studentAnswerIndex}
Correct answer: option index ${correctIndex}

Provide:
1. The correct answer
2. Why it's correct
3. Why the student's choice is wrong
4. A memorable key takeaway
5. Two follow-up micro-questions to reinforce the concept

Return this exact JSON schema:
{
  "tutor": {
    "correct_answer": "string — the correct option text",
    "why_correct": "string — clear explanation",
    "why_student_wrong": "string — specific to their chosen answer",
    "key_takeaway": "string — memorable clinical pearl",
    "follow_ups": [
      { "q": "string — micro question 1", "a": "string — answer 1" },
      { "q": "string — micro question 2", "a": "string — answer 2" }
    ]
  }
}`;
}

const FIX_PLAN_SYSTEM = `You are MedQ Planner. Based on a student's weakness data, create a focused
remediation plan. Output STRICT JSON only.`;

function fixPlanUserPrompt({ weaknessDataJSON, minutesAvailable, daysAvailable }) {
  return `Weakness data:
${JSON.stringify(weaknessDataJSON, null, 2)}

Available study time: ${minutesAvailable} minutes over ${daysAvailable} days.

Return this exact JSON schema:
{
  "fix_plan": {
    "summary": "string — one-line plan description",
    "priority_order": ["string — topic tags in order of urgency"],
    "tasks": [
      {
        "title": "string",
        "type": "REVIEW | QUESTIONS",
        "topicTag": "string",
        "estMinutes": "integer",
        "dayOffset": "integer — 0 = today, 1 = tomorrow, etc.",
        "focus": "string — what specifically to review"
      }
    ]
  }
}`;
}

const DOCUMENT_EXTRACT_SYSTEM = `You are a medical data extractor.
Extract lab results and return STRICT JSON ONLY.

Rules:
- Output must be valid JSON, no markdown, no comments, no extra text.
- Use this schema:
{
  "page": number,
  "records": [
    { "date": string|null, "test": string, "value": string, "unit": string|null, "flag": string|null }
  ]
}

Medical rules:
- Preserve the unit exactly as written (e.g. mmol/L, mg/dL).
- If date not present, set date null.
- If flag not present, set flag null.
- If no records are found on the page, return an empty records array.`;

function documentExtractUserPrompt({ pageIndex }) {
  return `Extract data from this page. Return JSON matching the schema. Set "page" = ${pageIndex}.`;
}

const EXPLORE_QUESTIONS_SYSTEM = `You are MedQ Question Writer. Generate exam-style single-best-answer (SBA)
questions for medical students on the requested topic.
Questions must be clinically relevant, unambiguous, and have exactly one
correct answer. Draw from established medical knowledge.
Use trusted references only (PubMed, UpToDate, Medscape) and cite them.
Output STRICT JSON only. No markdown, no commentary, no code fences.`;

function exploreQuestionsUserPrompt({
  topic,
  count,
  levelLabel,
  levelDescription,
  minDifficulty,
  maxDifficulty,
  hardFloorCount = 0,
  expertFloorCount = 0,
  complexityGuidance = "",
  strictMode = false,
  conciseMode = false,
  excludeStems = [],
}) {
  const stemHints = Array.isArray(excludeStems)
    ? excludeStems
      .map((stem) => String(stem || "").trim())
      .filter(Boolean)
      .slice(0, 8)
    : [];

  return `Topic: "${topic}"
Target audience: ${levelLabel} — ${levelDescription}
Difficulty range: ${minDifficulty} to ${maxDifficulty} (scale 1-5)
${hardFloorCount > 0 ? `Hard-floor target: at least ${hardFloorCount} questions must be difficulty 4 or 5` : ""}
${expertFloorCount > 0 ? `Expert-floor target: at least ${expertFloorCount} questions must be difficulty 5` : ""}
${complexityGuidance ? `Complexity guidance: ${complexityGuidance}` : ""}
${strictMode ? "Strict mode: Reject simplistic recall-only questions. Prefer nuanced clinical reasoning and management trade-offs." : ""}
${conciseMode ? "Concise mode: keep each explanation field compact (prefer <= 35 words) while still giving mechanism + clinical reasoning." : ""}
${stemHints.length > 0 ? `Avoid repeating or closely paraphrasing these stems:\n${stemHints.map((stem, i) => `${i + 1}. ${stem}`).join("\n")}` : ""}

Generate exactly ${count} SBA questions on this topic.

Quality rules:
- All questions must be directly relevant to "${topic}".
- Questions should match the ${levelLabel} level: ${levelDescription}
- Difficulty values must be between ${minDifficulty} and ${maxDifficulty}.
- Each stem must be a specific clinical vignette or focused question, not generic.
- Include exactly 5 options per question.
- Explanations must be thoughtful and clinically useful, not generic.
- For correct_why, include the decisive clinical clue + core mechanism + next-best interpretation.
- For why_others_wrong, explain why each option is incorrect in this vignette and why it could be tempting.
- Keep each explanation focused and non-redundant.
- Every question must include 2-3 citations from PubMed/UpToDate/Medscape only.
- For each citation, provide the source name and a specific topic/article title (do NOT generate URLs).

Return this exact JSON schema:
{
  "questions": [
    {
      "stem": "string — clinical vignette or direct question",
      "options": ["string", "string", "string", "string", "string"],
      "correct_index": "integer 0-4",
      "difficulty": "integer ${minDifficulty}-${maxDifficulty}",
      "tags": ["string — topic tags"],
      "explanation": {
        "correct_why": "string — why the correct answer is right",
        "why_others_wrong": [
          "string — why option A is wrong (or correct)",
          "string — why option B is wrong (or correct)",
          "string — why option C is wrong (or correct)",
          "string — why option D is wrong (or correct)",
          "string — why option E is wrong (or correct)"
        ],
        "key_takeaway": "string — the one thing to remember"
      },
      "citations": [
        {
          "source": "PUBMED | UPTODATE | MEDSCAPE",
          "title": "string — specific topic or article title for searching"
        }
      ]
    }
  ]
}`;
}

const EXPLORE_TOPIC_INSIGHT_SYSTEM = `You are MedQ Topic Tutor.
Create a high-yield, exam-focused topic briefing for a medical learner.
The content must be accurate, practical, and level-appropriate.
Use trusted references only (PubMed, UpToDate, Medscape) and cite them.
Output STRICT JSON only. No markdown, no commentary, no code fences.`;

function exploreTopicInsightUserPrompt({
  topic,
  levelLabel,
  levelDescription,
}) {
  return `Topic: "${topic}"
Target audience: ${levelLabel} — ${levelDescription}

Write a concise but thoughtful topic briefing.

Quality rules:
- Keep language clear and practical for ${levelLabel}.
- Prioritize mechanism-level understanding and clinical decision relevance.
- Include common pitfalls and red flags.
- Include a short study approach the learner can act on immediately.
- Provide 2-4 citations from PubMed/UpToDate/Medscape only.
- For each citation, provide source + specific topic/article title (do NOT generate URLs).

Return this exact JSON schema:
{
  "summary": "string — 4-7 sentence high-yield overview",
  "core_points": ["string — 5-8 key bullet points"],
  "clinical_pitfalls": ["string — 3-5 common mistakes or traps"],
  "red_flags": ["string — 2-5 urgent warning signs or escalation cues"],
  "study_approach": ["string — 3-5 concrete next study steps"],
  "citations": [
    {
      "source": "PUBMED | UPTODATE | MEDSCAPE",
      "title": "string — specific topic or article title for searching"
    }
  ]
}`;
}

module.exports = {
  BLUEPRINT_SYSTEM,
  blueprintUserPrompt,
  QUESTIONS_SYSTEM,
  questionsUserPrompt,
  TUTOR_SYSTEM,
  tutorUserPrompt,
  FIX_PLAN_SYSTEM,
  fixPlanUserPrompt,
  DOCUMENT_EXTRACT_SYSTEM,
  documentExtractUserPrompt,
  EXPLORE_QUESTIONS_SYSTEM,
  exploreQuestionsUserPrompt,
  EXPLORE_TOPIC_INSIGHT_SYSTEM,
  exploreTopicInsightUserPrompt,
};
