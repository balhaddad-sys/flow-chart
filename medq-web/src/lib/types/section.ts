import { Timestamp } from "firebase/firestore";

export interface ContentRef {
  type: string; // page | slide | word
  startIndex: number;
  endIndex: number;
}

export interface SectionBlueprint {
  learningObjectives: string[];
  keyConcepts: string[];
  highYieldPoints: string[];
  commonTraps: string[];
  termsToDefine: string[];
}

export interface SectionModel {
  id: string;
  fileId: string;
  courseId: string;
  title: string;
  contentRef: ContentRef;
  textBlobPath: string;
  textSizeBytes: number;
  estMinutes: number;
  difficulty: number;
  topicTags: string[];
  blueprint?: SectionBlueprint;
  aiStatus: string; // PENDING | PROCESSING | ANALYZED | FAILED
  questionsStatus: string;
  questionsCount: number;
  questionsErrorMessage?: string;
  lastErrorAt?: Timestamp;
  orderIndex: number;
  createdAt?: Timestamp;
}
