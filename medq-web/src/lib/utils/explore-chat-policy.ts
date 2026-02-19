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
  /\bcontraindicat(?:ion|ed)\b/i,
  /\brisk[-\s]?benefit\b/i,
  /\btrade[-\s]?off\b/i,
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

function levelSpecificGuidance(levelId: string): string {
  switch (levelId) {
    case "MD1":
    case "MD2":
      return "Define core terms, focus on first principles, and avoid specialist shorthand unless explained.";
    case "MD3":
    case "MD4":
      return "Prioritize clinical reasoning, compare likely differentials, and tie findings to first-line management.";
    case "MD5":
    case "INTERN":
    case "RESIDENT":
    case "POSTGRADUATE":
      return "Include high-acuity trade-offs, contraindications, escalation triggers, and where uncertainty affects decisions.";
    default:
      return "Match complexity to learner level, emphasizing mechanism + practical decision points.";
  }
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

  const useClaudeHaiku =
    explicitSensitiveRequest ||
    (delicateScore >= 1 && nuancedScore >= 1) ||
    delicateScore >= 2 ||
    nuancedScore >= 3;

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
  return `You are MedQ Explore Tutor, an expert medical education assistant.
The learner is studying: "${topic}".
Selected level: ${levelProfile.label} (${levelProfile.id}) — ${levelProfile.description}

${contextText}

Level calibration:
- Keep all explanations specific to ${levelProfile.label}.
- ${levelSpecificGuidance(levelProfile.id)}

Rules:
- Answer only within the requested topic; if asked outside, briefly redirect.
- Be accurate, evidence-based, and clinically oriented.
- State uncertainty clearly when evidence is mixed or context is missing.
- Keep answers concise (3-6 sentences) unless the learner asks for more detail.
- This is for education only, not clinical advice.
${highSensitivityMode
    ? "- This request is clinically delicate/nuanced: use extra care, avoid overconfident wording, and include safe escalation cues when relevant."
    : ""}`;
}

