import type { TeachingSection } from "@/lib/firebase/functions";

export const EXPLORE_DIG_DEEPER_EVENT = "medq:explore-dig-deeper";

export interface ExploreDigDeeperEventDetail {
  topic: string;
  sectionId: string;
  sectionTitle: string;
  prompt: string;
}

interface BuildExploreDigDeeperPromptParams {
  topic: string;
  section: TeachingSection;
}

export function buildExploreDigDeeperPrompt({
  topic,
  section,
}: BuildExploreDigDeeperPromptParams): string {
  const summaryText = section.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  const focusPoints = section.keyPoints
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 4);

  const focusBlock =
    focusPoints.length > 0
      ? focusPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")
      : "Use the highest-yield concepts from this section.";

  return [
    `Dig deeper into the "${section.title}" section for topic "${topic}".`,
    summaryText ? `Current section summary: ${summaryText}` : "",
    `Focus points:\n${focusBlock}`,
    "Please include:",
    "1) deeper mechanism and clinical reasoning",
    "2) common exam traps and high-yield red flags",
    "3) one short clinical vignette with answer explanation",
    "4) a concise memory framework",
  ]
    .filter(Boolean)
    .join("\n\n");
}
