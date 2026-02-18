import { Timestamp } from "firebase/firestore";

export interface TimeWindow {
  earliest?: Timestamp;
  latest?: Timestamp;
}

export interface TaskModel {
  id: string;
  courseId: string;
  type: "STUDY" | "QUESTIONS" | "REVIEW" | (string & {});
  title: string;
  sectionIds: string[];
  topicTags: string[];
  estMinutes: number;
  actualMinutes?: number;
  difficulty: number;
  dueDate: Timestamp;
  timeWindow?: TimeWindow;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED" | (string & {});
  completedAt?: Timestamp;
  isPinned: boolean;
  priority: number;
  orderIndex: number;
  parentTaskId?: string;
  linkedQuestionSetId?: string;
  isFixPlan?: boolean;
  createdAt?: Timestamp;
}
