/**
 * Canonical status enums for MedQ.
 *
 * These are the single source of truth for status values across the product.
 * Backend (Cloud Functions), web (Next.js), and mobile (Flutter) MUST use
 * these exact values. Any new status must be added here first.
 */

// ── File Processing Pipeline ────────────────────────────────────────────────

export const FILE_STATUS = {
  UPLOADED: "UPLOADED",
  QUEUED: "QUEUED",
  PARSING: "PARSING",
  CHUNKING: "CHUNKING",
  INDEXING: "INDEXING",
  GENERATING: "GENERATING",
  READY_PARTIAL: "READY_PARTIAL",
  READY_FULL: "READY_FULL",
  READY: "READY", // legacy alias for READY_FULL
  FAILED: "FAILED",
} as const;

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export const FILE_STATUS_LABELS: Record<string, { label: string; description: string }> = {
  UPLOADED: { label: "Waiting", description: "Uploaded — waiting for analysis" },
  QUEUED: { label: "Queued", description: "Queued — processing will begin shortly" },
  PARSING: { label: "Reading", description: "Step 1/3: Reading your file..." },
  CHUNKING: { label: "Analyzing", description: "Step 2/3: AI is studying the content..." },
  INDEXING: { label: "Indexing", description: "Step 2/3: AI is studying the content..." },
  GENERATING: { label: "Generating", description: "Step 3/3: Generating questions..." },
  PROCESSING: { label: "Analyzing", description: "Being analyzed by AI..." },
  READY_PARTIAL: { label: "Ready", description: "Ready to study" },
  READY_FULL: { label: "Ready", description: "Ready to study" },
  READY: { label: "Ready", description: "Ready to study" },
  ANALYZED: { label: "Ready", description: "Ready to study" },
  FAILED: { label: "Failed", description: "Analysis failed — tap to retry" },
};

// ── Section AI Status ───────────────────────────────────────────────────────

export const SECTION_AI_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  ANALYZED: "ANALYZED",
  FAILED: "FAILED",
} as const;

// ── Question Generation Status ──────────────────────────────────────────────

export const QUESTION_STATUS = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

// ── Task Status ─────────────────────────────────────────────────────────────

export const TASK_STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  SKIPPED: "SKIPPED",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// ── Question Quality ────────────────────────────────────────────────────────

export const QUESTION_QUALITY = {
  DRAFT: "draft",
  NORMAL: "normal",
  VERIFIED: "verified",
} as const;

// ── Helper: check if a file is in a "processing" state ──────────────────────

export function isFileProcessing(status: string): boolean {
  return ["UPLOADED", "QUEUED", "PARSING", "CHUNKING", "INDEXING", "GENERATING", "PROCESSING"].includes(status);
}

export function isFileReady(status: string): boolean {
  return ["READY", "READY_FULL", "READY_PARTIAL", "ANALYZED"].includes(status);
}
