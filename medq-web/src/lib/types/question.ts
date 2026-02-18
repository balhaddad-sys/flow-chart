import { Timestamp } from "firebase/firestore";

export interface QuestionExplanation {
  correctWhy: string;
  whyOthersWrong: string[];
  keyTakeaway: string;
}

/** Legacy URL-based citation. */
export interface QuestionCitation {
  source: string;
  title: string;
  url: string;
}

/**
 * Chunk-level source citation pointing back to the user's uploaded file.
 * Powers the "View Source" drawer for AI transparency.
 */
export interface QuestionSourceCitation {
  fileId: string;
  chunkId: string;
  pageNumber?: number;
  slideIndex?: number;
  /** Exact snippet from the source document that validates this question */
  quote: string;
}

export interface QuestionSourceRef {
  fileId: string | null;
  fileName?: string;
  sectionId: string;
  label: string;
}

export interface QuestionStats {
  timesAnswered: number;
  timesCorrect: number;
  avgTimeSec: number;
}

/** Quality label driving the "Draft" badge and confidence UI. */
export type QuestionQuality = "draft" | "normal" | "verified";

export interface QuestionModel {
  id: string;
  courseId: string;
  sectionId: string;
  topicTags: string[];
  difficulty: number;
  type: "SBA" | (string & {});
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: QuestionExplanation;
  sourceRef: QuestionSourceRef;
  /** Chunk-level source citations for the "View Source" drawer */
  sourceCitations?: QuestionSourceCitation[];
  /** Legacy URL-based citations */
  citations?: QuestionCitation[];
  stats: QuestionStats;
  /** AI confidence score (0–1). Below 0.72 → quality becomes "draft" */
  confidenceScore?: number;
  /** Quality state — determines badge shown in the practice UI */
  quality?: QuestionQuality;
  /** Number of student flag reports received */
  flagCount?: number;
  /** True for questions from the pre-seeded sample deck */
  isSampleDeck?: boolean;
  createdAt?: Timestamp;
}
