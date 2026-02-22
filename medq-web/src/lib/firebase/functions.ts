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
const CLIENT_TIMEOUT_MS = 180_000;

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

export interface AssessmentLevel {
  id: string;
  label: string;
  description: string;
  targetDifficulty: { min: number; max: number };
  recommendedDailyMinutes: number;
}

export interface AssessmentTopic {
  id: string;
  label: string;
  description: string;
  availableQuestions: number;
}

export interface AssessmentQuestion {
  id: string;
  stem: string;
  options: string[];
  difficulty: number;
  topicTags: string[];
}

export interface AssessmentAnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation?: {
    correctWhy?: string;
    whyOthersWrong?: string[];
    keyTakeaway?: string;
  } | null;
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
}

export interface AssessmentReportTopic {
  tag: string;
  attempts: number;
  accuracy: number;
  avgTimeSec: number;
  avgConfidence: number | null;
  weaknessScore: number;
  severity: "CRITICAL" | "REINFORCE" | "STRONG";
}

export interface AssessmentRecommendationAction {
  title: string;
  focusTag: string;
  rationale: string;
  recommendedMinutes: number;
  drills: string[];
}

export interface AssessmentReport {
  sessionId: string;
  courseId: string;
  topicTag: string;
  level: string;
  answeredCount: number;
  totalQuestions: number;
  overallAccuracy: number;
  readinessScore: number;
  avgTimeSec: number;
  targetTimeSec: number;
  weaknessProfile: AssessmentReportTopic[];
  recommendations: {
    summary: string;
    priorityTopics: string[];
    actions: AssessmentRecommendationAction[];
    examTips: string[];
  };
  completedAtISO: string;
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
  return callFunction<{
    questionCount: number;
    skippedCount: number;
    generatedNow?: number;
    fromCache?: boolean;
    inProgress?: boolean;
    backgroundQueued?: boolean;
    remainingCount?: number;
    targetCount?: number;
    readyNow?: number;
    jobId?: string | null;
    durationMs?: number;
    message?: string;
    aiRequestCount?: number;
    predictedYield?: number;
    estimatedSavingsPercent?: number;
  }>(
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

// --- Adaptive Assessment ---
export function getAssessmentCatalog(params: { courseId: string }) {
  return callFunction<{
    levels: AssessmentLevel[];
    topics: AssessmentTopic[];
    defaultLevel: string;
  }>("getAssessmentCatalog", params);
}

export function startAssessmentSession(params: {
  courseId: string;
  topicTag: string;
  level: string;
  questionCount?: number;
}) {
  return callFunction<{
    sessionId: string;
    topicTag: string;
    level: string;
    levelLabel: string;
    targetTimeSec: number;
    questions: AssessmentQuestion[];
  }>("startAssessmentSession", params);
}

export function submitAssessmentAnswer(params: {
  sessionId: string;
  questionId: string;
  answerIndex: number;
  timeSpentSec: number;
  confidence?: number;
}) {
  return callFunction<AssessmentAnswerResult>(
    "submitAssessmentAnswer",
    params
  );
}

export function finishAssessmentSession(params: { sessionId: string }) {
  return callFunction<AssessmentReport>("finishAssessmentSession", params);
}

// --- Explore ---
export interface ExploreQuestion {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  difficulty: number;
  topicTags: string[];
  type: string;
  explanation: {
    correctWhy: string;
    whyOthersWrong: string[];
    keyTakeaway: string;
  };
  citations?: Array<{
    source: string;
    title: string;
    url: string;
  }>;
  citationMeta?: {
    trustedSourceCount: number;
    uniqueSources: string[];
    citationCount: number;
    fallbackUsed: boolean;
    evidenceQuality: "HIGH" | "MODERATE" | "LOW" | string;
  };
}

export interface ExploreQuizResult {
  questions: ExploreQuestion[];
  topic: string;
  level: string;
  levelLabel: string;
  modelUsed: string;
  qualityGatePassed?: boolean;
  qualityScore?: number;
  targetCount?: number;
  readyNow?: number;
  remainingCount?: number;
  backgroundQueued?: boolean;
  backgroundJobId?: string;
  fromCache?: boolean;
}

export interface TeachingSection {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
  unit?: string;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface EpidemiologyChart {
  title: string;
  type: "bar" | "horizontal_bar";
  xLabel: string;
  yLabel: string;
  dataPoints: ChartDataPoint[];
  sourceCitation: string;
  sourceUrl: string;
}

export interface TreatmentComparisonChart {
  title: string;
  type: "bar" | "grouped_bar";
  categories: string[];
  series: ChartSeries[];
  unit: string;
  sourceCitation: string;
  sourceUrl: string;
}

export interface DiagnosticAlgorithmStep {
  id: string;
  label: string;
  type: "decision" | "action" | "endpoint";
  yesNext: string | null;
  noNext: string | null;
  next: string | null;
}

export interface DiagnosticAlgorithmChart {
  title: string;
  steps: DiagnosticAlgorithmStep[];
  sourceCitation: string;
}

export interface PrognosticChart {
  title: string;
  type: "bar";
  dataPoints: ChartDataPoint[];
  sourceCitation: string;
  sourceUrl: string;
}

export interface TopicChartData {
  epidemiology?: EpidemiologyChart;
  treatmentComparison?: TreatmentComparisonChart;
  diagnosticAlgorithm?: DiagnosticAlgorithmChart;
  prognosticData?: PrognosticChart;
}

export interface ExploreTopicInsightResult {
  topic: string;
  level: string;
  levelLabel: string;
  modelUsed: string;
  summary: string;
  teachingSections: TeachingSection[];
  corePoints: string[];
  clinicalFramework: {
    pathophysiology: string;
    diagnosticApproach: string[];
    managementApproach: string[];
    escalationTriggers: string[];
  };
  chartData: TopicChartData;
  clinicalPitfalls: string[];
  redFlags: string[];
  studyApproach: string[];
  guidelineUpdates: Array<{
    year: number | null;
    source: string;
    title: string;
    keyChange: string;
    practiceImpact: string;
    strength: "HIGH" | "MODERATE" | "EMERGING" | string;
    impactScore: number;
    url: string;
  }>;
  citations?: Array<{
    source: string;
    title: string;
    url: string;
  }>;
  fromCache?: boolean;
}

export function exploreQuiz(params: {
  topic: string;
  level: string;
  count?: number;
}) {
  return callFunction<ExploreQuizResult>("exploreQuiz", params);
}

export function exploreTopicInsight(params: {
  topic: string;
  level: string;
  examType?: string;
  questionContext?: string;
}) {
  return callFunction<ExploreTopicInsightResult>("exploreTopicInsight", params);
}

// --- Exam Bank ---

export interface GenerateExamBankResult {
  questions: ExploreQuestion[];
  totalCount: number;
  domain: string;
  examType: string;
  modelUsed: string;
}

export function generateExamBankQuestions(params: {
  examType: string;
  count?: number;
}) {
  return callFunction<GenerateExamBankResult>("generateExamBankQuestions", params);
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

// --- Admin: Reprocess Blueprints ---
export function reprocessBlueprints(params: { courseId?: string }) {
  return callFunction<{
    updated: number;
    failed: number;
    total: number;
    message: string;
  }>("reprocessBlueprints", params);
}

// ── Consumer-ready additions ────────────────────────────────────────────────

export type FlagReason =
  | "incorrect"
  | "ambiguous"
  | "bad_explanation"
  | "source_mismatch"
  | "duplicate"
  | "other";

/** Flag a question for quality review. */
export function flagQuestion(params: {
  questionId: string;
  reason: FlagReason;
  freeText?: string;
}) {
  return callFunction<{ flagId: string }>("flagQuestion", params);
}

/** Seed the high-yield sample deck into a new user's account. */
export function seedSampleDeck() {
  return callFunction<{
    courseId: string | null;
    questionCount: number;
    alreadySeeded: boolean;
  }>("seedSampleDeck", {});
}
