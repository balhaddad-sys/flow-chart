import { Timestamp } from "firebase/firestore";

export interface ChatThread {
  id: string;
  courseId: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  createdAt?: Timestamp;
}

export interface ChatCitation {
  sectionId: string;
  sectionTitle: string;
  excerpt: string;
}
