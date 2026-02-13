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
  status: string; // UPLOADED | PROCESSING | READY | FAILED
  errorMessage?: string;
  processingPhase?: string; // EXTRACTING | ANALYZING | GENERATING_QUESTIONS
  processingStartedAt?: Timestamp;
  processedAt?: Timestamp;
  sectionCount: number;
  uploadedAt?: Timestamp;
}
