import { Timestamp } from "firebase/firestore";

export interface TimeWindow {
  earliest?: Timestamp;
  latest?: Timestamp;
}

export interface TaskModel {
  id: string;
  courseId: string;
  type: string; // STUDY | QUESTIONS | REVIEW
  title: string;
  sectionIds: string[];
  topicTags: string[];
  estMinutes: number;
  actualMinutes?: number;
  difficulty: number;
  dueDate: Timestamp;
  timeWindow?: TimeWindow;
  status: string; // TODO | IN_PROGRESS | DONE | SKIPPED
  completedAt?: Timestamp;
  isPinned: boolean;
  priority: number;
  orderIndex: number;
  parentTaskId?: string;
  linkedQuestionSetId?: string;
  isFixPlan?: boolean;
  createdAt?: Timestamp;
}
