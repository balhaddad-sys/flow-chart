import { Timestamp } from "firebase/firestore";

export interface FileMeta {
  pageCount?: number;
  slideCount?: number;
  wordCount?: number;
}

export interface FileModel {
  id: string;
  courseId: string;
  moduleId?: string;
  topicId?: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  meta: FileMeta;
  status: "UPLOADED" | "QUEUED" | "PARSING" | "CHUNKING" | "INDEXING" | "GENERATING" | "PROCESSING" | "READY" | "READY_PARTIAL" | "READY_FULL" | "FAILED" | (string & {});
  errorMessage?: string;
  processingPhase?: "EXTRACTING" | "ANALYZING" | "GENERATING_QUESTIONS" | (string & {});
  processingStartedAt?: Timestamp;
  processedAt?: Timestamp;
  sectionCount: number;
  uploadedAt?: Timestamp;
}
