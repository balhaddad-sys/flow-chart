import { Timestamp } from "firebase/firestore";

export interface QuestionExplanation {
  correctWhy: string;
  whyOthersWrong: string[];
  keyTakeaway: string;
}

export interface QuestionSourceRef {
  fileId: string;
  fileName?: string;
  sectionId: string;
  label: string;
}

export interface QuestionStats {
  timesAnswered: number;
  timesCorrect: number;
  avgTimeSec: number;
}

export interface QuestionModel {
  id: string;
  courseId: string;
  sectionId: string;
  topicTags: string[];
  difficulty: number;
  type: string; // SBA
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: QuestionExplanation;
  sourceRef: QuestionSourceRef;
  stats: QuestionStats;
  createdAt?: Timestamp;
}
