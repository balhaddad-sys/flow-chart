import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "./client";

interface CloudFunctionResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

/* ── Error class ─────────────────────────────────────────────────────── */

const TRANSIENT_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "resource-exhausted",
  "internal",
  "RATE_LIMIT",
  "UNAVAILABLE",
]);

export class CloudFunctionError extends Error {
  public readonly isTransient: boolean;

  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CloudFunctionError";
    this.isTransient = TRANSIENT_CODES.has(code);
  }
}

/* ── Retry-aware caller ──────────────────────────────────────────────── */

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1_000;
const CLIENT_TIMEOUT_MS = 120_000;

function isTransientError(err: unknown): boolean {
  if (err instanceof CloudFunctionError) return err.isTransient;
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: unknown }).code);
    return (
      code.includes("unavailable") ||
      code.includes("deadline-exceeded") ||
      code.includes("network")
    );
  }
  return false;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callFunction<
  T = Record<string, unknown>,
  D = Record<string, unknown>,
>(name: string, data: D): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const callable = httpsCallable<D, CloudFunctionResponse>(functions, name);

      const result: HttpsCallableResult<CloudFunctionResponse> =
        await Promise.race([
          callable(data),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new CloudFunctionError("deadline-exceeded", "Request timed out. Please try again.")),
              CLIENT_TIMEOUT_MS
            )
          ),
        ]);

      const response = result.data;

      if (!response.success) {
        const code = response.error?.code ?? "UNKNOWN";
        const message = response.error?.message ?? "Unknown error";
        throw new CloudFunctionError(code, message);
      }

      return (response.data ?? response) as T;
    } catch (err) {
      lastError = err;

      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const jitter = Math.random() * 500;
        await delay(BASE_DELAY_MS * Math.pow(2, attempt) + jitter);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/* ── Types ───────────────────────────────────────────────────────────── */

export type QuizMode = "section" | "topic" | "mixed" | "random";

export interface TutorResponse {
  correctAnswer: string;
  whyCorrect: string;
  whyStudentWrong: string;
  keyTakeaway: string;
  followUps: Array<{ q: string; a: string }>;
}

export interface SectionSummaryResponse {
  summary: string;
  keyPoints: string[];
  mnemonics: string[];
}

// --- Course ---
export function createCourse(params: {
  title: string;
  examDate?: string;
  examType?: string;
  tags?: string[];
  availability?: Record<string, unknown>;
}) {
  return callFunction("createCourse", params);
}

// --- Schedule ---
export function generateSchedule(params: {
  courseId: string;
  availability: Record<string, unknown>;
  revisionPolicy: string;
}) {
  return callFunction<{
    feasible: boolean;
    deficit?: number;
    taskCount?: number;
    totalDays?: number;
    extendedWindow?: boolean;
    spillDays?: number;
    originalDeficit?: number;
  }>("generateSchedule", params);
}

export function regenSchedule(params: {
  courseId: string;
  keepCompleted?: boolean;
}) {
  return callFunction("regenSchedule", params);
}

export function catchUp(params: { courseId: string }) {
  return callFunction("catchUp", params);
}

// --- Questions ---
export function generateQuestions(params: {
  courseId: string;
  sectionId: string;
  count?: number;
}) {
  return callFunction<{ questionCount: number; skippedCount: number }>(
    "generateQuestions",
    params
  );
}

export function getQuiz(params: {
  courseId: string;
  sectionId?: string;
  topicTag?: string;
  mode: QuizMode;
  count?: number;
}) {
  return callFunction<{ questions: Record<string, unknown>[] }>(
    "getQuiz",
    params
  );
}

export function submitAttempt(params: {
  questionId: string;
  answerIndex: number;
  timeSpentSec: number;
  confidence?: number;
}) {
  return callFunction<{
    correct: boolean;
    attemptId: string;
    tutorResponse: TutorResponse | null;
  }>("submitAttempt", params);
}

export function getTutorHelp(params: {
  questionId: string;
  attemptId: string;
}) {
  return callFunction<{ tutorResponse: TutorResponse }>(
    "getTutorHelp",
    params
  );
}

export function generateSectionSummary(params: {
  title: string;
  sectionText: string;
}) {
  return callFunction<SectionSummaryResponse>(
    "generateSectionSummary",
    params
  );
}

// --- Fix Plan ---
export function runFixPlan(params: { courseId: string }) {
  return callFunction("runFixPlan", params);
}

// --- Document Processing ---
export function processDocumentBatch(params: {
  images: string[];
  concurrency?: number;
}) {
  return callFunction("processDocumentBatch", params);
}

// --- Retry Failed Sections ---
export function retryFailedSections(params: { fileId: string }) {
  return callFunction<{ retriedCount: number; message: string }>(
    "retryFailedSections",
    params
  );
}

// --- Chat ---
export function sendChatMessage(params: {
  threadId: string;
  message: string;
  courseId: string;
}) {
  return callFunction<{
    userMessageId: string;
    response: string;
    citations: { sectionTitle: string; relevance: string }[];
  }>("sendChatMessage", params);
}

// --- File Management ---
export function deleteFile(params: { fileId: string }) {
  return callFunction<{ deletedSections: number; deletedQuestions: number }>(
    "deleteFile",
    params
  );
}

// --- User Data ---
export function deleteUserData() {
  return callFunction("deleteUserData", {});
}
