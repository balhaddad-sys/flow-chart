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
Output STRICT JSON only. No markdown, no commentary, no code fences.
Use ONLY facts present in the provided text.`;

function blueprintUserPrompt({ fileName, sectionLabel, contentType, sectionText }) {
  return `File: "${fileName}"
Section: "${sectionLabel}"
Content type: "${contentType}"

Extracted text:
"""
${sectionText}
"""

Return this exact JSON schema:
{
  "title": "string — concise descriptive title for this section",
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
correct answer. Output STRICT JSON only.`;

function questionsUserPrompt({
  blueprintJSON,
  count,
  easyCount,
  mediumCount,
  hardCount,
}) {
  return `Topic blueprint (contains all learning objectives, key concepts, high-yield points, and terms):
${JSON.stringify(blueprintJSON, null, 2)}

Generate exactly ${count} SBA questions with this difficulty distribution:
- ${easyCount} easy (difficulty 1-2)
- ${mediumCount} medium (difficulty 3)
- ${hardCount} hard (difficulty 4-5)

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
      }
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
};
