/**
 * @module index
 * @description Entry point for MedQ Cloud Functions.
 *
 * Initialises Firebase Admin and re-exports every Cloud Function so that the
 * Firebase CLI can discover and deploy them.
 *
 * Functions are organised into five domains:
 *
 *   processing  — Document ingestion pipeline (Storage / Firestore triggers)
 *   scheduling  — Study-plan generation, regeneration, and catch-up
 *   questions   — AI question generation, quiz retrieval, and tutor help
 *   analytics   — Attempt logging, weakness computation, and fix plans
 *   admin       — Course management, health checks, GDPR data deletion
 */

const admin = require("firebase-admin");

admin.initializeApp();

// ── Processing pipeline ──────────────────────────────────────────────────────
const { processUploadedFile } = require("./processing/processFile");
const { processSection } = require("./processing/processSection");
const { processDocumentBatch } = require("./processing/processDocumentBatch");
const { retryFailedSections } = require("./processing/retryFailedSections");

// ── Scheduling ───────────────────────────────────────────────────────────────
const { generateSchedule } = require("./scheduling/generateSchedule");
const { regenSchedule } = require("./scheduling/regenSchedule");
const { catchUp } = require("./scheduling/catchUp");

// ── Questions ────────────────────────────────────────────────────────────────
const { generateQuestions } = require("./questions/generateQuestions");
const { processQuestionBackfillJob } = require("./questions/processQuestionBackfillJob");
const { getQuiz } = require("./questions/getQuiz");
const { getTutorHelp } = require("./questions/getTutorHelp");
const { generateSectionSummary } = require("./study/generateSectionSummary");
const { getAssessmentCatalog } = require("./assessment/getAssessmentCatalog");
const { startAssessmentSession } = require("./assessment/startAssessmentSession");
const { submitAssessmentAnswer } = require("./assessment/submitAssessmentAnswer");
const { finishAssessmentSession } = require("./assessment/finishAssessmentSession");

// ── Explore ─────────────────────────────────────────────────────────────────
const { exploreQuiz } = require("./explore/exploreQuiz");

// ── Analytics ────────────────────────────────────────────────────────────────
const { submitAttempt } = require("./analytics/submitAttempt");
const { computeWeakness } = require("./analytics/computeWeakness");
const { runFixPlan } = require("./analytics/runFixPlan");

// ── Admin ────────────────────────────────────────────────────────────────────
const { createCourse } = require("./admin/createCourse");
const { deleteUserData } = require("./admin/deleteUserData");
const { deleteFile } = require("./admin/deleteFile");
const { healthCheck } = require("./admin/healthCheck");

// ── Exports ──────────────────────────────────────────────────────────────────
exports.processUploadedFile = processUploadedFile;
exports.processSection = processSection;
exports.processDocumentBatch = processDocumentBatch;
exports.retryFailedSections = retryFailedSections;
exports.generateSchedule = generateSchedule;
exports.regenSchedule = regenSchedule;
exports.catchUp = catchUp;
exports.generateQuestions = generateQuestions;
exports.processQuestionBackfillJob = processQuestionBackfillJob;
exports.getQuiz = getQuiz;
exports.getTutorHelp = getTutorHelp;
exports.generateSectionSummary = generateSectionSummary;
exports.getAssessmentCatalog = getAssessmentCatalog;
exports.startAssessmentSession = startAssessmentSession;
exports.submitAssessmentAnswer = submitAssessmentAnswer;
exports.finishAssessmentSession = finishAssessmentSession;
exports.exploreQuiz = exploreQuiz;
exports.submitAttempt = submitAttempt;
exports.computeWeakness = computeWeakness;
exports.runFixPlan = runFixPlan;
exports.createCourse = createCourse;
exports.deleteUserData = deleteUserData;
exports.deleteFile = deleteFile;
exports.healthCheck = healthCheck;

// ── Chat ─────────────────────────────────────────────────────────────────
const { sendChatMessage } = require("./chat/sendChatMessage");
exports.sendChatMessage = sendChatMessage;
