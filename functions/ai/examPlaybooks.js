/**
 * @module ai/examPlaybooks
 * @description Curated exam intelligence profiles used to harden question-writing prompts.
 */

function normalizeExamType(examType) {
  return String(examType || "SBA").toUpperCase();
}

const DEFAULT_PLAYBOOK = {
  label: "Generic medical SBA exam mode",
  context: "Mixed medical curriculum with single-best-answer emphasis.",
  coverageBlueprint: [
    "Core diagnosis and differential logic",
    "First-line investigations and interpretation",
    "Evidence-aligned management and escalation",
  ],
  questionConstruction: [
    "Use concise but information-dense clinical vignettes with one decisive clue.",
    "Ensure five plausible options where only one is best in context.",
    "Mix diagnosis, investigation, and management stems across the set.",
  ],
  clinicalReasoning: [
    "Force disambiguation between close differentials.",
    "Prioritize patient safety and next-best-step reasoning over trivia.",
    "Explain why the correct answer wins against the strongest distractor.",
  ],
  avoid: [
    "One-liner recall stems with no clinical context.",
    "Distractors that are obviously wrong without reasoning.",
    "Overly broad stems that test multiple unrelated topics at once.",
  ],
};

const EXAM_PLAYBOOKS = {
  PLAB1: {
    label: "PLAB 1",
    context: "UK licensing exam using single-best-answer questions in NHS-style scenarios.",
    coverageBlueprint: [
      "Acute care priorities: sepsis, chest pain, breathlessness, stroke, AKI",
      "Primary care presentations and safe referral thresholds",
      "BNF-safe prescribing and adverse-effect recognition",
      "GMC ethics and UK legal frameworks (capacity, consent, safeguarding)",
    ],
    questionConstruction: [
      "Anchor vignettes to UK settings (GP, A&E, acute ward, clinic).",
      "Make NICE/BNF-concordant management the winning discriminator.",
      "Use common-but-tricky presentations that punish unsafe shortcuts.",
    ],
    clinicalReasoning: [
      "Require candidates to choose safest immediate action before definitive action.",
      "Differentiate diagnosis certainty vs watchful waiting vs urgent escalation.",
      "Test practical UK systems knowledge when clinically relevant.",
    ],
    avoid: [
      "US-only guideline assumptions or drug naming.",
      "Subspecialty rarity with no frontline relevance.",
      "Ethics stems without practical action framing.",
    ],
  },
  PLAB2: {
    label: "PLAB 2",
    context: "UK OSCE-style licensing exam focused on communication, structure, and safe decisions.",
    coverageBlueprint: [
      "History-taking structure (including ICE) and focused exam sequencing",
      "Communication under pressure: consent, bad news, uncertainty, safety-netting",
      "Acute triage and immediate stabilization priorities",
      "Professionalism and safeguarding in realistic NHS pathways",
    ],
    questionConstruction: [
      "Write station-like stems with candidate role, setting, and task clarity.",
      "Use options that represent communication or behavioral choices, not just diagnoses.",
      "Reward structure-first responses that demonstrate safety and empathy.",
    ],
    clinicalReasoning: [
      "Prioritize rapport + safety + clarity before technical depth.",
      "Distinguish acceptable communication from excellent communication.",
      "Include escalation and documentation choices where appropriate.",
    ],
    avoid: [
      "Pure factual recall with no station behavior.",
      "Options that all sound empathic but differ only in tone.",
      "Ignoring patient agenda or shared decision-making.",
    ],
  },
  MRCP_PART1: {
    label: "MRCP Part 1",
    context: "High-difficulty best-of-five exam requiring mechanism-grounded internal medicine reasoning.",
    coverageBlueprint: [
      "Cardiology and ECG/arrhythmia logic",
      "Respiratory and acid-base interpretation",
      "Endocrine/metabolic integration (thyroid, diabetes, adrenal, calcium)",
      "Renal/electrolyte syndromes and nephrology pattern recognition",
      "Neurology and multi-system diagnostic discrimination",
    ],
    questionConstruction: [
      "Build vignettes where one subtle clue flips the best answer.",
      "Prefer investigation interpretation and mechanism-led management decisions.",
      "Keep distractors clinically credible and close in plausibility.",
    ],
    clinicalReasoning: [
      "Force stepwise elimination between adjacent diagnoses.",
      "Link findings to pathophysiology before choosing intervention.",
      "Reward guideline-aware but nuance-sensitive decisions.",
    ],
    avoid: [
      "Surface-level pattern matching stems.",
      "Questions solvable without integrating at least two data points.",
      "Over-simplified management when contraindications are present.",
    ],
  },
  MRCP_PACES: {
    label: "MRCP PACES",
    context: "Clinical station exam emphasizing bedside method, sign interpretation, and communication.",
    coverageBlueprint: [
      "Systematic physical examination performance and sequencing",
      "Interpretation of bedside signs and focused differentials",
      "Patient communication in complex or sensitive contexts",
      "Clinical synthesis, presentation, and immediate plan articulation",
    ],
    questionConstruction: [
      "Frame stems as bedside encounters requiring candidate actions.",
      "Use options that reflect examination order, phrasing, and interpretation choices.",
      "Include examiner-style pitfalls (missed sign, unsafe wording, skipped safety-net).",
    ],
    clinicalReasoning: [
      "Assess what to do first at bedside, then what to conclude.",
      "Differentiate technically correct but poorly prioritized approaches.",
      "Integrate professionalism into clinical decisions.",
    ],
    avoid: [
      "Pure textbook diagnosis questions detached from bedside method.",
      "Ambiguous options with no practical action difference.",
      "Ignoring communication performance in station scenarios.",
    ],
  },
  MRCGP_AKT: {
    label: "MRCGP AKT",
    context: "Primary care exam balancing clinical management, evidence interpretation, and systems practice.",
    coverageBlueprint: [
      "Chronic disease control in primary care pathways",
      "Preventive care, screening, and risk-threshold decisions",
      "Primary care prescribing safety and deprescribing",
      "Stats/critical appraisal and GP medicolegal governance",
    ],
    questionConstruction: [
      "Use GP-first contexts with realistic follow-up constraints.",
      "Test referral urgency thresholds and community-first management.",
      "Mix clinical and non-clinical AKT domains across the batch.",
    ],
    clinicalReasoning: [
      "Reward pragmatic decisions under uncertainty in community settings.",
      "Use data interpretation that changes management.",
      "Prioritize continuity, safety, and resource-appropriate care.",
    ],
    avoid: [
      "Hospital-only framing with no GP decision angle.",
      "Statistics questions disconnected from patient decisions.",
      "Ignoring prescribing governance and follow-up plans.",
    ],
  },
  USMLE_STEP1: {
    label: "USMLE Step 1",
    context: "Mechanism-heavy foundational science exam mapped to clinical vignettes.",
    coverageBlueprint: [
      "Pathophysiology integration across organ systems",
      "Pharmacology mechanisms, adverse effects, contraindications",
      "Microbiology/immunology reasoning and host-response patterns",
      "Biochemistry/genetics with clinically anchored interpretation",
    ],
    questionConstruction: [
      "Hide mechanism clues in clinically plausible stems.",
      "Use distractors that fail because of specific mechanism details.",
      "Demand interpretation of lab/path findings, not rote facts.",
    ],
    clinicalReasoning: [
      "Require first-principles reasoning before diagnosis labeling.",
      "Bridge molecular detail to patient-level manifestation.",
      "Prioritize mechanistic discriminators over memorized buzzwords.",
    ],
    avoid: [
      "Management-first questions better suited for Step 2 CK.",
      "Recall-only factoids with no mechanistic reasoning.",
      "Non-specific clues that allow broad guessing.",
    ],
  },
  USMLE_STEP2: {
    label: "USMLE Step 2 CK",
    context: "Clinical decision-making exam focused on diagnosis, next-best-step, and management flow.",
    coverageBlueprint: [
      "Emergency stabilization and first-line inpatient actions",
      "Outpatient management pathways and follow-up decisions",
      "OB/GYN, pediatrics, psych, and internal medicine high-yield scenarios",
      "Preventive care and guideline-concordant sequencing",
    ],
    questionConstruction: [
      "Write management-timeline stems that require prioritization.",
      "Use data interpretation that changes immediate next action.",
      "Keep options as competing actions at the same decision node.",
    ],
    clinicalReasoning: [
      "Emphasize what to do now vs what can wait.",
      "Test risk stratification and harm minimization.",
      "Distinguish diagnostic certainty from action thresholds.",
    ],
    avoid: [
      "Mechanism-deep stems with no management consequence.",
      "Options that mix different timeline horizons unfairly.",
      "Ignoring contraindications and comorbidity trade-offs.",
    ],
  },
  FINALS: {
    label: "Medical Finals",
    context: "Undergraduate exit-level exam balancing core medicine, surgery, and communication.",
    coverageBlueprint: [
      "Common presentations and emergency first steps",
      "Investigation selection and basic result interpretation",
      "Core treatment algorithms and prescribing safety",
      "Communication and practical clinical judgement",
    ],
    questionConstruction: [
      "Prefer bread-and-butter conditions with subtle exam traps.",
      "Mix SBA knowledge and practical OSCE-style action stems.",
      "Keep complexity appropriate for graduating students.",
    ],
    clinicalReasoning: [
      "Reward safe, structured thinking over niche detail.",
      "Assess ability to prioritize immediate risks.",
      "Use incremental clue integration across the vignette.",
    ],
    avoid: [
      "Highly subspecialist edge cases without core relevance.",
      "Question sets dominated by one specialty only.",
      "Options requiring postgraduate-only assumptions.",
    ],
  },
  OSCE: {
    label: "General OSCE",
    context: "Clinical station style mode for history, exam flow, communication, and safety.",
    coverageBlueprint: [
      "Structured history and focused exam planning",
      "Communication quality in challenging consultations",
      "Safe escalation, handover, and follow-up",
    ],
    questionConstruction: [
      "Frame vignettes as candidate actions in real station contexts.",
      "Use options as alternative communication/clinical approaches.",
      "Ensure one clearly safest and best-structured response.",
    ],
    clinicalReasoning: [
      "Prioritize patient-centred language and safety.",
      "Differentiate adequate vs excellent station performance.",
      "Include clear escalation cues in acute scenarios.",
    ],
    avoid: [
      "Pure diagnosis recall without interaction context.",
      "Vague options with no practical behavior difference.",
      "Ignoring empathy and consent components.",
    ],
  },
  SBA: DEFAULT_PLAYBOOK,
};

function buildExamPlaybookPrompt(examType) {
  const key = normalizeExamType(examType);
  const playbook = EXAM_PLAYBOOKS[key] || DEFAULT_PLAYBOOK;

  return `Exam intelligence profile: ${playbook.label}
Context: ${playbook.context}
This profile is a pre-curated high-yield exam analysis. Use it to shape the question bank.

Coverage blueprint (target mix):
${playbook.coverageBlueprint.map((item) => `- ${item}`).join("\n")}

Question construction requirements:
${playbook.questionConstruction.map((item) => `- ${item}`).join("\n")}

Clinical reasoning requirements:
${playbook.clinicalReasoning.map((item) => `- ${item}`).join("\n")}

Avoid:
${playbook.avoid.map((item) => `- ${item}`).join("\n")}`;
}

module.exports = {
  normalizeExamType,
  EXAM_PLAYBOOKS,
  buildExamPlaybookPrompt,
};
