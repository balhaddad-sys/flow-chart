import { httpsCallable } from "firebase/functions";
import { functions } from "./client";

interface CloudFunctionResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function callFunction<T = Record<string, unknown>, D = Record<string, unknown>>(
  name: string,
  data: D
): Promise<T> {
  const callable = httpsCallable<D, CloudFunctionResponse>(functions, name);
  const result = await callable(data);
  const response = result.data;

  if (!response.success) {
    const code = response.error?.code ?? "UNKNOWN";
    const message = response.error?.message ?? "Unknown error";
    throw new CloudFunctionError(code, message);
  }

  return (response.data ?? response) as T;
}

export class CloudFunctionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CloudFunctionError";
  }
}

export type QuizMode = "section" | "topic" | "mixed" | "random";

export interface TutorResponse {
  correctAnswer: string;
  whyCorrect: string;
  whyStudentWrong: string;
  keyTakeaway: string;
  followUps: Array<{ q: string; a: string }>;
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
  return callFunction<{ feasible: boolean; deficit?: number; taskCount?: number; totalDays?: number }>(
    "generateSchedule",
    params
  );
}

export function regenSchedule(params: { courseId: string; keepCompleted?: boolean }) {
  return callFunction("regenSchedule", params);
}

export function catchUp(params: { courseId: string }) {
  return callFunction("catchUp", params);
}

// --- Questions ---
export function generateQuestions(params: { courseId: string; sectionId: string; count?: number }) {
  return callFunction("generateQuestions", params);
}

export function getQuiz(params: {
  courseId: string;
  sectionId?: string;
  topicTag?: string;
  mode: QuizMode;
  count?: number;
}) {
  return callFunction<{ questions: Record<string, unknown>[] }>("getQuiz", params);
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

export function getTutorHelp(params: { questionId: string; attemptId: string }) {
  return callFunction<{ tutorResponse: TutorResponse }>("getTutorHelp", params);
}

// --- Fix Plan ---
export function runFixPlan(params: { courseId: string }) {
  return callFunction("runFixPlan", params);
}

// --- Document Processing ---
export function processDocumentBatch(params: { images: string[]; concurrency?: number }) {
  return callFunction("processDocumentBatch", params);
}

// --- Retry Failed Sections ---
export function retryFailedSections(params: { fileId: string }) {
  return callFunction<{ retriedCount: number; message: string }>("retryFailedSections", params);
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
  return callFunction<{ deletedSections: number; deletedQuestions: number }>("deleteFile", params);
}

// --- User Data ---
export function deleteUserData() {
  return callFunction("deleteUserData", {});
}
