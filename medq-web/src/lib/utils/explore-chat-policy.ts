export type ExploreChatProvider = "gemini" | "claude-haiku";

export interface ExploreLevelProfile {
  id: string;
  label: string;
  description: string;
}

export interface ExploreChatRoutingDecision {
  provider: ExploreChatProvider;
  delicateScore: number;
  nuancedScore: number;
  reason: string;
}

const LEVELS: readonly ExploreLevelProfile[] = [
  {
    id: "MD1",
    label: "MD1 (Foundations)",
    description: "Core pre-clinical recall and basic mechanisms.",
  },
  {
    id: "MD2",
    label: "MD2 (Integrated Basics)",
    description: "System integration and early clinical application.",
  },
  {
    id: "MD3",
    label: "MD3 (Clinical Core)",
    description: "Clinical reasoning with common presentations.",
  },
  {
    id: "MD4",
    label: "MD4 (Advanced Clinical)",
    description: "Complex cases, management trade-offs, prioritization.",
  },
  {
    id: "MD5",
    label: "MD5 (Senior Clinical)",
    description: "High-yield exam synthesis and advanced differentials.",
  },
  {
    id: "INTERN",
    label: "Doctor Intern",
    description: "Fast, safe clinical decisions in frontline workflow.",
  },
  {
    id: "RESIDENT",
    label: "Resident",
    description: "Higher-acuity management and protocol-level decisions.",
  },
  {
    id: "POSTGRADUATE",
    label: "Doctor Postgraduate",
    description: "Subspecialty-level nuance and high-complexity reasoning.",
  },
];

const LEVEL_ALIAS_MAP: Record<string, string> = {
  MD5L: "MD5",
  MD5LEVEL: "MD5",
  DOCTORINTERN: "INTERN",
  RESIDENCY: "RESIDENT",
  DOCTORPOSTGRADUATE: "POSTGRADUATE",
  POSTGRAD: "POSTGRADUATE",
  PG: "POSTGRADUATE",
};

const DELICATE_PATTERNS: readonly RegExp[] = [
  /\bend[-\s]?of[-\s]?life\b/i,
  /\bpalliative\b/i,
  /\bhospice\b/i,
  /\bterminal\b/i,
  /\bgoals?\s+of\s+care\b/i,
  /\bmiscarriage\b/i,
  /\bstillbirth\b/i,
  /\bpregnan(?:cy|t)\b/i,
  /\bneonat(?:e|al)\b/i,
  /\binfant\b/i,
  /\bpediatr(?:ic|ics)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[-\s]?harm\b/i,
  /\bsexual\s+assault\b/i,
  /\brape\b/i,
  /\bdomestic\s+violence\b/i,
  /\babuse\b/i,
  /\bcapacity\b/i,
  /\bconsent\b/i,
  /\bethic(?:s|al)?\b/i,
];

const NUANCED_PATTERNS: readonly RegExp[] = [
  /\bcontraindicat(?:ion|ions|ed)\b/i,
  /\brisk[-\s]?benefit\b/i,
  /\btrade[-\s]?offs?\b/i,
  /\bdifferential\b/i,
  /\bcomplex\b/i,
  /\bnuanc(?:e|ed)\b/i,
  /\bcomorbid(?:ity|ities)\b/i,
  /\bpolypharmacy\b/i,
  /\bdrug[-\s]?interaction\b/i,
  /\bresistant\b/i,
  /\brefractory\b/i,
  /\bimmunocompromised\b/i,
  /\bimmunosuppressed\b/i,
  /\brenal\s+(?:failure|impairment|dose)\b/i,
  /\bhepatic\s+(?:failure|impairment|dose)\b/i,
  /\bescalat(?:e|ion)\b/i,
  /\bprotocol\b/i,
  /\bguideline\b/i,
  /\buncertaint(?:y|ies)\b/i,
  /\bequivocal\b/i,
];

function matchScore(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((score, pattern) => (pattern.test(text) ? score + 1 : score), 0);
}

function resolveLevelId(rawLevel: unknown): string {
  const compact = String(rawLevel || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return LEVEL_ALIAS_MAP[compact] || compact;
}

interface LevelCalibration {
  vocabulary: string;
  include: string;
  exclude: string;
  format: string;
  forbidden: string;
}

const LEVEL_CALIBRATION: Record<string, LevelCalibration> = {
  MD1: {
    vocabulary:
      "Use everyday language. Introduce one piece of medical terminology at a time, always defining it immediately in plain English.",
    include:
      "Core mechanism (why it happens), one key anatomy or physiology fact, and a simple real-world analogy if helpful.",
    exclude:
      "Drug dosing, management protocols, diagnostic criteria, clinical scoring systems, and specialist abbreviations.",
    format:
      "Start with a one-sentence plain-English answer. Then explain the mechanism in 2-3 sentences. End with one memorable takeaway.",
    forbidden:
      "Do NOT use unexplained acronyms (e.g. write 'myocardial infarction (heart attack)' not just 'MI'). Do NOT discuss management or treatment unless directly asked.",
  },
  MD2: {
    vocabulary:
      "Use standard medical terminology but briefly gloss any subspecialty term. Assume basic anatomy and physiology are known.",
    include:
      "Pathophysiological mechanism, how systems interact, and the bridge from basic science to early clinical pattern.",
    exclude:
      "Specific drug choices, guideline thresholds, and advanced diagnostic workups.",
    format:
      "One clear mechanism-focused answer. Connect the basic science to what the student will see clinically. 3-5 sentences.",
    forbidden:
      "Do NOT skip the 'why' — every clinical fact must be anchored to a mechanism. Do NOT list management steps without explaining the underlying logic.",
  },
  MD3: {
    vocabulary:
      "Use full clinical terminology without glossing common terms. Assume systems integration is understood.",
    include:
      "Top 2-3 differentials with distinguishing features, first-line diagnostic approach, and initial management principle.",
    exclude:
      "Rare edge cases, subspecialty escalation, and advanced pharmacology unless directly relevant.",
    format:
      "Lead with the most likely diagnosis or key concept. Give a concise differential with one distinguishing clue each. End with the first clinical action. 4-6 sentences.",
    forbidden:
      "Do NOT present a single diagnosis without differentials. Do NOT omit the reasoning chain from symptom to diagnosis.",
  },
  MD4: {
    vocabulary:
      "Use full clinical and pharmacological terminology. Assume strong clinical reasoning baseline.",
    include:
      "Risk stratification, management trade-offs, when to escalate, and relevant red flags or contraindications.",
    exclude:
      "Basic mechanism explanations unless the question specifically asks for them.",
    format:
      "State the clinical priority first. Then address management with explicit trade-offs. Mention at least one contraindication or complication to watch for. 4-6 sentences.",
    forbidden:
      "Do NOT give a simple list without reasoning. Do NOT ignore comorbidity or polypharmacy implications if they are relevant to the question.",
  },
  MD5: {
    vocabulary:
      "Use advanced clinical, pharmacological, and evidence-based terminology freely.",
    include:
      "High-yield exam differentials, evidence quality caveats, guideline-concordant vs guideline-discordant scenarios, and decision uncertainty.",
    exclude:
      "Foundational mechanism explanations unless specifically requested.",
    format:
      "Lead with the highest-yield clinical point. Address complexity, uncertainty, and evidence strength directly. 4-7 sentences. Do not oversimplify.",
    forbidden:
      "Do NOT give a single clean answer where genuine clinical uncertainty exists — state the uncertainty explicitly. Do NOT omit exam-relevant nuances.",
  },
  INTERN: {
    vocabulary:
      "Use direct clinical language as spoken on the ward. No need to explain standard terms.",
    include:
      "Immediate safe action, must-not-miss diagnoses, escalation triggers, and one practical bedside pearl.",
    exclude:
      "Long theoretical discussions, basic science mechanisms, and academic debate unless asked.",
    format:
      "Answer as if handing off at the bedside: what to do now, what to watch for, when to escalate. Concise and action-oriented. 3-5 sentences.",
    forbidden:
      "Do NOT bury the action in theory. Do NOT omit safety-critical caveats (allergies, renal dosing, deterioration signs).",
  },
  RESIDENT: {
    vocabulary:
      "Use subspecialty-level clinical and pharmacological language without simplification.",
    include:
      "Protocol-level decisions, evidence-based escalation thresholds, drug interactions, organ-specific dosing adjustments, and multidisciplinary considerations.",
    exclude:
      "Basic clinical reasoning steps already assumed at this level.",
    format:
      "Lead with the management decision or clinical priority. Include at least one evidence caveat or guideline reference. Address the hardest part of the clinical question explicitly. 5-7 sentences.",
    forbidden:
      "Do NOT oversimplify complex management. Do NOT ignore known drug interactions or dosing adjustments when the context implies they are relevant.",
  },
  POSTGRADUATE: {
    vocabulary:
      "Use subspecialty, research-level, and guideline-specific language without restriction.",
    include:
      "Subspecialty nuance, evidence quality and limitations, guideline discordance where it exists, rare but high-stakes differentials, and areas of active clinical debate.",
    exclude:
      "Simplifications, analogies, and foundational explanations.",
    format:
      "Engage with the full complexity of the question. Acknowledge evidence gaps or conflicting guidelines if relevant. Discuss the most nuanced or contested aspect directly. 5-8 sentences.",
    forbidden:
      "Do NOT smooth over genuine clinical controversy. Do NOT give a textbook answer where real-world practice diverges from guidelines.",
  },
};

function getLevelCalibration(levelId: string): LevelCalibration {
  return (
    LEVEL_CALIBRATION[levelId] ||
    LEVEL_CALIBRATION["MD3"]
  );
}

export function normalizeExploreLevel(level: unknown): ExploreLevelProfile {
  const levelId = resolveLevelId(level);
  return LEVELS.find((item) => item.id === levelId) || LEVELS[2];
}

export function chooseExploreChatProvider({
  topic,
  message,
}: {
  topic: string;
  message: string;
}): ExploreChatRoutingDecision {
  const combined = `${topic}\n${message}`.toLowerCase();
  const delicateScore = matchScore(combined, DELICATE_PATTERNS);
  const nuancedScore = matchScore(combined, NUANCED_PATTERNS);
  const explicitSensitiveRequest =
    /\b(highly delicate|clinically nuanced|sensitive case|edge case)\b/i.test(combined);

  const highDelicateSignal =
    delicateScore >= 2 ||
    (delicateScore >= 1 &&
      /\b(suicid(?:e|al)|self[-\s]?harm|sexual\s+assault|pregnan(?:cy|t)|end[-\s]?of[-\s]?life|terminal|abuse)\b/i.test(
        combined
      ));
  const highNuancedSignal =
    nuancedScore >= 2 ||
    /\b(clinically nuanced|complex case|trade[-\s]?offs?|contraindicat(?:ion|ions|ed)|guideline discordance|edge case)\b/i.test(
      combined
    );

  const useClaudeHaiku =
    explicitSensitiveRequest ||
    (highDelicateSignal && highNuancedSignal);

  return {
    provider: useClaudeHaiku ? "claude-haiku" : "gemini",
    delicateScore,
    nuancedScore,
    reason: useClaudeHaiku
      ? "Sensitive/nuanced clinical query detected; routing to Claude Haiku."
      : "Standard educational query; routing to Gemini fast path.",
  };
}

export function buildExploreTutorSystemPrompt({
  topic,
  levelProfile,
  contextText,
  highSensitivityMode,
}: {
  topic: string;
  levelProfile: ExploreLevelProfile;
  contextText: string;
  highSensitivityMode: boolean;
}): string {
  const cal = getLevelCalibration(levelProfile.id);

  return `You are MedQ Explore Tutor, an expert medical education assistant.
The learner is studying: "${topic}".
Selected level: ${levelProfile.label} (${levelProfile.id}) — ${levelProfile.description}

${contextText ? `Context:\n${contextText}\n` : ""}
=== LEVEL CONTRACT: ${levelProfile.label} ===
You MUST calibrate every response strictly to this level. Do not drift up or down.

Vocabulary: ${cal.vocabulary}
Include: ${cal.include}
Exclude: ${cal.exclude}
Format: ${cal.format}
${cal.forbidden}

=== RULES ===
- Answer only within the requested topic; if the learner asks outside it, briefly redirect.
- Be accurate and evidence-based. State uncertainty explicitly when evidence is mixed or context is missing.
- This is for education only, not clinical advice.
${highSensitivityMode
    ? "- SENSITIVE CONTENT FLAG: This query is clinically delicate or nuanced. Use careful, measured wording. Avoid overconfident conclusions. Include safe escalation cues where relevant."
    : ""}`;
}
