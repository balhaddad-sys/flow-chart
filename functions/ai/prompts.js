/**
 * @module ai/prompts
 * @description System and user prompt templates for every AI-powered feature.
 *
 * All prompts enforce **strict JSON output** with exact field schemas so that
 * downstream code can parse responses without ambiguity.  Each prompt pair
 * consists of a constant system prompt and a builder function that assembles
 * the user message from runtime data.
 */
const { buildExamPlaybookPrompt } = require("./examPlaybooks");

/**
 * Returns exam-type-specific question writing instructions.
 * @param {'SBA'|'OSCE'|'Mixed'|string} examType
 */
function examTypeInstructions(examType) {
  switch ((examType || "SBA").toUpperCase()) {

    case "PLAB1":
      return `Exam: PLAB 1 (GMC UK Medical Licensing — SBA format, 180 questions)
Question style: UK NHS clinical vignettes with a single best answer from five options.
- Set ALL clinical scenarios in a UK NHS context (GP surgery, A&E, ward, outpatient clinic)
- Use UK drug names throughout: paracetamol (not acetaminophen), adrenaline (not epinephrine), salbutamol (not albuterol), metronidazole (not flagyl)
- Reference UK guidelines: NICE, BNF, SIGN, PHE, RCOG, JRCALC
- Include GMC ethics and professionalism scenarios: confidentiality, consent, capacity (Mental Capacity Act 2005), Gillick competence, duty of candour, safeguarding
- High-yield topics: sepsis six, NEWS2 scoring, referral pathways, safe prescribing, infection control, common GP presentations
- Question lead-ins: "What is the single best management?", "What is the most appropriate next step?", "Which is the most likely diagnosis?"`;

    case "PLAB2":
      return `Exam: PLAB 2 (GMC UK Clinical Assessment — 18 OSCE stations)
Question style: UK NHS clinical station scenarios testing what the candidate DOES and SAYS.
- Write stems as station scenarios: "You are the FY1 doctor in A&E. The patient in front of you…"
- Test: structured history taking (SOCRATES, ICE — Ideas, Concerns, Expectations), clinical examination sequences, communication skills
- Include: breaking bad news, obtaining informed consent, SBAR handover, prescribing safety, recognising the sick patient (ABCDE approach)
- Options represent different approaches or communication choices, not diagnoses
- UK clinical context: NHS settings, GMC Good Medical Practice, safeguarding referrals
- Lead-ins: "What is the most appropriate opening?", "Which examination should be performed first?", "How should this be communicated?"`;

    case "MRCP_PART1":
      return `Exam: MRCP Part 1 (Royal Colleges of Physicians UK — Best of Five, 200 questions)
Question style: Challenging Best-of-Five questions with strong basic science underpinning clinical practice.
- Questions are harder than PLAB 1 — require mechanism-level understanding, not just recognition
- High-yield specialties: cardiology (ECG interpretation, heart failure, arrhythmias), respiratory, endocrinology (thyroid, diabetes, adrenal), rheumatology, nephrology, neurology
- Include: rare but high-yield conditions, abnormal investigation interpretation, pathophysiology-driven reasoning
- Use UK drug names and reference UK/European guidelines (ESC, BTS, NICE, BSR)
- Avoid straightforward recall; every question should require reasoning to distinguish the best answer
- Lead-ins: "What is the most likely underlying mechanism?", "Which investigation would be most useful?", "What is the most appropriate management?"`;

    case "MRCP_PACES":
      return `Exam: MRCP PACES (Royal Colleges of Physicians — 5 clinical stations)
Question style: Clinical examination and communication station scenarios.
- Stations: respiratory examination, abdominal examination, cardiovascular examination, history taking, communication skills and ethics
- Test: systematic examination technique, clinical sign recognition, structured history (presenting complaint → systems review → ICE), communication (breaking bad news, explaining diagnoses, handling uncertainty)
- Options represent different examination approaches or communication strategies
- Include: findings interpretation, differential construction from clinical signs, management discussion
- Lead-ins: "What is the most appropriate initial examination step?", "Which finding is most consistent with the diagnosis?", "How should this information be shared with the patient?"`;

    case "MRCGP_AKT":
      return `Exam: MRCGP AKT (Applied Knowledge Test — 200 questions, GP specialty)
Question style: Primary care-focused SBA questions covering clinical medicine, critical appraisal, and administrative/legal topics.
- Set scenarios in GP surgery, out-of-hours, or community settings
- High-yield: chronic disease management (hypertension, diabetes, COPD, asthma — all to NICE guidelines), mental health in primary care, prescribing (BNF), safeguarding, referral thresholds
- Include: data interpretation (NNT, sensitivity/specificity, screening statistics), audit and research methods, GP administrative and medicolegal scenarios
- Use UK primary care terminology: QOF, EMIS, MDT, GPSI, CQC
- Lead-ins: "What is the most appropriate management in primary care?", "Which patient should be referred urgently?", "What does this data suggest?"`;

    case "USMLE_STEP1":
      return `Exam: USMLE Step 1 (NBME — Basic Science, SBA format)
Question style: Mechanism-heavy vignettes requiring strong basic science reasoning.
- Each question should test pathophysiology, biochemistry, pharmacology, microbiology, immunology, or anatomy underpinning a clinical scenario
- US clinical context: American drug names (acetaminophen, epinephrine, albuterol), FDA-approved treatments, American nomenclature
- Questions should require understanding the mechanism, not just recognising a pattern
- High-yield: enzyme deficiencies, receptor pharmacology, cell biology, genetic disorders, microbial virulence factors, immunodeficiency syndromes
- Distractors must be plausible at the mechanism level — wrong because of a specific mechanistic reason
- Lead-ins: "Which of the following best explains the mechanism?", "What is the most likely cause of this finding?", "Which enzyme is deficient?"`;

    case "USMLE_STEP2":
      return `Exam: USMLE Step 2 CK (NBME — Clinical Knowledge, SBA format)
Question style: Clinical management vignettes using American guidelines and evidence-based medicine.
- US clinical context: American drug names, AHA/ACC guidelines, USPSTF screening recommendations, CDC vaccination schedules
- Focus: diagnosis, next best step, first-line management, recognising complications, interpreting investigations
- Include: clinical decision-making under uncertainty, management of comorbidities, high-acuity scenarios (ER and inpatient)
- Questions should feel like real clinical decisions — "What do you do next for this patient?"
- High-yield: acute MI management, sepsis bundles, psychiatric emergencies, obstetric complications, paediatric milestones
- Lead-ins: "What is the most appropriate next step?", "Which management is most appropriate at this time?", "What is the most likely diagnosis?"`;

    case "FINALS":
      return `Exam: Medical Finals (University — Mixed SBA + OSCE)
Question style: Blend of knowledge-based SBA vignettes and OSCE-style clinical skills questions.
- SBA questions: diagnosis, mechanism, investigation, management — core medical and surgical conditions
- OSCE questions: history taking, clinical examination, communication, procedural skills
- Cover the core medical school curriculum: medicine, surgery, obstetrics, paediatrics, psychiatry, primary care
- Appropriate difficulty for a graduating medical student — avoid subspecialty-only content
- Mix question types across the set so no two consecutive questions use the same format`;

    case "OSCE":
      return `Exam type: OSCE (Objective Structured Clinical Examination)
Question style: Clinical station scenarios testing what the student DOES and SAYS.
- Write stems as station scenarios: "You are the doctor seeing a patient who…"
- Test: structured history taking, clinical examination sequences, communication skills (consent, breaking bad news, SBAR), safe prescribing, procedural steps
- Options represent clinical approaches or communication choices, not diagnoses
- Lead-ins: "What is the most appropriate next step?", "How should this be communicated to the patient?", "Which approach is safest?"`;

    default: // SBA and any unknown key
      return `Exam type: SBA (Single Best Answer)
Question style: Classic clinical knowledge vignettes with one best answer from five options.
- Each stem must test diagnosis, mechanism, pharmacology, investigation interpretation, or management
- Distractors must be plausible but clearly inferior on close reasoning
- Lead-ins: "What is the most likely diagnosis?", "What is the most appropriate initial management?", "Which investigation should be ordered next?"`;
  }
}

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
  "title": "string — a descriptive topic-based title derived from the actual content (e.g. 'Neuronal Migration & Axon Guidance', 'Cardiac Electrophysiology'), NEVER use page numbers or file names; include specific medical terms so neighboring sections have distinct titles",
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
Questions must be clinically relevant, non-repetitive, unambiguous, and have exactly one
correct answer.
Prioritize reasoning depth over trivial recall.
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
  examType = "SBA",
}) {
  return `Source file: "${sourceFileName}"
Section: "${sectionTitle}"
${examTypeInstructions(examType)}
${buildExamPlaybookPrompt(examType)}

Topic blueprint (contains all learning objectives, key concepts, high-yield points, and terms):
${JSON.stringify(blueprintJSON)}

Generate exactly ${count} questions with this difficulty distribution:
- ${easyCount} easy (difficulty 1-2)
- ${mediumCount} medium (difficulty 3)
- ${hardCount} hard (difficulty 4-5)

Quality rules:
- Every question must test a concrete concept from key_concepts, high_yield_points, or terms_to_define.
- Do not write generic stems; each stem must be specific to this section.
- Vary question style across the set in line with the exam type instructions above.
- Do not paraphrase the same vignette pattern or repeat the same lead-in phrasing.
- Vary demographics, context, and clinical clues while staying faithful to the blueprint.
- Before writing questions, map the set to the coverage blueprint above and ensure broad domain spread (minimum 3 distinct blueprint domains when available).
- Keep explanations concise and precise (1-2 sentences per field), but include the decisive clue and mechanism.
- why_others_wrong must be specific to this vignette for each option; avoid generic filler.
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
  learnedContext = "",
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
${learnedContext ? `Teaching context:\n${learnedContext}` : ""}
${strictMode ? "Strict mode: Reject simplistic recall-only questions. Prefer nuanced clinical reasoning and management trade-offs." : ""}
${conciseMode ? "Concise mode: keep each explanation field compact (prefer <= 35 words) while still giving mechanism + clinical reasoning." : ""}
${stemHints.length > 0 ? `Avoid repeating or closely paraphrasing these stems:\n${stemHints.map((stem, i) => `${i + 1}. ${stem}`).join("\n")}` : ""}

Generate exactly ${count} SBA questions on this topic.

Quality rules:
- TOPIC SCOPE: Stay tightly scoped to "${topic}". Do NOT generate questions about the broader parent topic — only test concepts that are directly part of "${topic}" itself.
- If a teaching content summary appears in the Teaching context above, anchor your questions to that material — the quiz must test what was actually taught.
- All questions must be directly relevant to "${topic}".
- Questions should match the ${levelLabel} level: ${levelDescription}
- Difficulty values must be between ${minDifficulty} and ${maxDifficulty}.
- Each stem must be a specific clinical vignette or focused question, not generic.
- Include exactly 5 options per question.
- Explanations must be thoughtful and clinically useful, not generic.
- For correct_why, include the decisive clinical clue + core mechanism + next-best interpretation.
- For why_others_wrong, explain why each option is incorrect in this vignette and why it could be tempting.
- Keep each explanation focused and non-redundant.
- Avoid repeating prior scenario templates; vary patient demographics and presentation style while staying within topic scope.
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

const EXPLORE_TOPIC_INSIGHT_SYSTEM = `You are MedQ Topic Teacher.
Your module must be laser-focused on the EXACT topic the learner selected.
If the topic is a subtopic (e.g. "antihypertensive drugs", "ACE inhibitors for heart failure", "ECG changes in MI"),
treat it as your SOLE focus — cover the parent condition only with 1-2 sentences of essential context.
Never turn a specific subtopic into a generic overview of the parent condition.
Create a comprehensive, well-structured teaching module that is thorough enough to serve as a standalone learning resource on that specific topic.
Include structured numerical data suitable for rendering charts and visual summaries.
All statistics and data points must cite a real source (PubMed, UpToDate, Medscape).
Output STRICT JSON only. No markdown, no commentary, no code fences.`;

function exploreTopicInsightUserPrompt({
  topic,
  levelLabel,
  levelDescription,
}) {
  return `Topic: "${topic}"
Target audience: ${levelLabel} — ${levelDescription}

FOCUS CONSTRAINT: Your entire module must stay anchored to "${topic}".
Do NOT expand into the broader parent topic. If "${topic}" is a specific drug class, mechanism, procedure, or clinical aspect, keep every section tightly scoped to it.
Include background on the parent condition only where it is essential to understanding "${topic}" (1-2 introductory sentences maximum).
The teaching sections must reflect the actual subtopic — for example:
- "antihypertensive drugs" → sections on drug classes, mechanisms, selection criteria, side-effect profiles, comparisons; NOT a generic hypertension overview
- "ECG in MI" → sections on STEMI/NSTEMI patterns, leads, evolution of changes; NOT a general MI pathophysiology review
- "OSCE history taking" → sections on structure, ICE, SOCRATES, red flags; NOT a broad history-taking theory module

Write a comprehensive teaching module — NOT a brief summary.

Content rules:
- Write detailed, multi-paragraph teaching sections covering the topic thoroughly.
- Each teaching section should explain concepts with clinical reasoning, not just list facts.
- Language should be appropriate for ${levelLabel}.
- Prioritize mechanism-level understanding and clinical decision-making.
- Include structured chart data with real statistics from published studies.
- Every chart data point must cite a specific source.
- Include 5-10 recent guideline/review updates (prefer last 5 years).
- Provide 5-10 citations from PubMed/UpToDate/Medscape only.
- For each citation, provide source + specific article title (do NOT generate URLs).

Return this exact JSON schema:
{
  "summary": "string — 8-12 sentence comprehensive overview of the topic",
  "teaching_sections": [
    {
      "id": "string — unique id e.g. overview, epidemiology, pathophysiology, diagnosis, management, prognosis",
      "title": "string — section heading",
      "content": "string — 3-6 paragraphs of detailed teaching narrative with clinical reasoning",
      "key_points": ["string — 3-5 high-yield takeaways for this section"]
    }
  ],
  "core_points": ["string — 8-12 key bullet points across the entire topic"],
  "clinical_framework": {
    "pathophysiology": "string — detailed mechanism explanation (2-4 paragraphs)",
    "diagnostic_approach": ["string — practical diagnostic steps with reasoning"],
    "management_approach": ["string — treatment priorities with evidence context"],
    "escalation_triggers": ["string — signs that require urgent escalation"]
  },
  "chart_data": {
    "epidemiology": {
      "title": "string — chart title e.g. Prevalence by Age Group",
      "type": "bar",
      "x_label": "string — x-axis label",
      "y_label": "string — y-axis label",
      "data_points": [
        { "label": "string", "value": "number", "unit": "string e.g. % or per 100k" }
      ],
      "source_citation": "string — specific source for this data"
    },
    "treatment_comparison": {
      "title": "string — e.g. First-line Treatment Efficacy",
      "type": "grouped_bar",
      "categories": ["string — treatment names"],
      "series": [
        { "name": "string — metric name e.g. Response Rate", "values": ["number — one per category"] }
      ],
      "unit": "string — e.g. % response rate",
      "source_citation": "string"
    },
    "diagnostic_algorithm": {
      "title": "string — e.g. Diagnostic Workup Algorithm",
      "steps": [
        {
          "id": "string — unique step id",
          "label": "string — step description",
          "type": "decision | action | endpoint",
          "yes_next": "string|null — id of next step if yes (for decision type)",
          "no_next": "string|null — id of next step if no (for decision type)",
          "next": "string|null — id of next step (for action type)"
        }
      ],
      "source_citation": "string"
    },
    "prognostic_data": {
      "title": "string — e.g. 5-Year Survival by Stage",
      "type": "bar",
      "data_points": [
        { "label": "string", "value": "number", "unit": "string" }
      ],
      "source_citation": "string"
    }
  },
  "clinical_pitfalls": ["string — 4-6 common mistakes or traps"],
  "red_flags": ["string — 3-5 urgent warning signs or escalation cues"],
  "study_approach": ["string — 4-6 concrete next study steps"],
  "guideline_updates": [
    {
      "year": "integer|null — publication/update year when known",
      "source": "PUBMED | UPTODATE | MEDSCAPE",
      "title": "string — guideline/review title",
      "key_change": "string — what changed or what is emphasized",
      "practice_impact": "string — why this matters in clinical decisions",
      "strength": "string — HIGH | MODERATE | EMERGING"
    }
  ],
  "citations": [
    {
      "source": "PUBMED | UPTODATE | MEDSCAPE",
      "title": "string — specific topic or article title for searching"
    }
  ]
}

Important:
- teaching_sections should cover at minimum: Overview, Epidemiology, Pathophysiology, Diagnosis, Management. Add Prognosis or Complications if relevant.
- chart_data fields are all optional — populate whichever are relevant to the topic. Skip any that do not apply.
- All chart data_points must contain real published statistics, not fabricated numbers.
- diagnostic_algorithm steps should form a valid flowchart (each step's next/yes_next/no_next must reference another step id or null for terminal).`;
}

const QUESTIONS_FROM_TEXT_SYSTEM = `You are MedQ Question Writer. Analyze the provided study material and
generate exam-style single-best-answer (SBA) questions for medical students.
First identify the key concepts, high-yield facts, and common pitfalls in the text,
then write questions that test understanding of those concepts.
Questions must be clinically relevant, non-repetitive, unambiguous, and have exactly one
correct answer.
Prioritize reasoning depth over trivial recall.
Every explanation must cite trusted medical sources (PubMed, UpToDate, Medscape).
Output STRICT JSON only.`;

function questionsFromTextUserPrompt({
  sectionText,
  count,
  easyCount,
  mediumCount,
  hardCount,
  sectionTitle = "Unknown Section",
  sourceFileName = "Unknown File",
  examType = "SBA",
}) {
  return `Source file: "${sourceFileName}"
Section: "${sectionTitle}"
${examTypeInstructions(examType)}
${buildExamPlaybookPrompt(examType)}

Study material:
"""
${sectionText}
"""

Analyze the text above. Identify the key medical concepts, high-yield exam facts,
important terms, and common misconceptions. Then generate exactly ${count} questions
that test understanding of this material, strictly following the exam type instructions above.

Difficulty distribution:
- ${easyCount} easy (difficulty 1-2)
- ${mediumCount} medium (difficulty 3)
- ${hardCount} hard (difficulty 4-5)

Quality rules:
- Every question must test a concrete concept from the provided text.
- Do not write generic stems; each stem must be specific to this section's content.
- Vary question style across the set in line with the exam type instructions above.
- Do not paraphrase the same vignette pattern or repeat the same lead-in phrasing.
- Vary demographics, context, and clinical clues while staying faithful to the source material.
- Before writing questions, map the set to the coverage blueprint above and ensure broad domain spread (minimum 3 distinct blueprint domains when available).
- Keep explanations concise and precise (1-2 sentences per field), but include the decisive clue and mechanism.
- why_others_wrong must be specific to this vignette for each option; avoid generic filler.
- Do not combine unrelated topics from different parts of the text into one vague question.
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

module.exports = {
  examTypeInstructions,
  BLUEPRINT_SYSTEM,
  blueprintUserPrompt,
  QUESTIONS_SYSTEM,
  questionsUserPrompt,
  QUESTIONS_FROM_TEXT_SYSTEM,
  questionsFromTextUserPrompt,
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
