import { Timestamp } from "firebase/firestore";

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdBy: string;
  memberCount: number;
  members: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GroupMember {
  uid: string;
  name: string;
  email: string;
  joinedAt?: Timestamp;
}

export interface GroupChallenge {
  id: string;
  groupId: string;
  title: string;
  courseId: string;
  sectionId?: string;
  questionCount: number;
  createdBy: string;
  participants: string[];
  leaderboard: ChallengeEntry[];
  status: string; // ACTIVE | COMPLETED
  createdAt?: Timestamp;
}

export interface ChallengeEntry {
  uid: string;
  name: string;
  score: number;
  accuracy: number;
  completedAt?: Timestamp;
}
