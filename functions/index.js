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
 *   questions   — AI question generation and quiz retrieval
 *   analytics   — Attempt logging and weakness computation
 *   admin       — Health checks, GDPR data deletion
 */

const admin = require("firebase-admin");

admin.initializeApp();

// ── Processing pipeline ──────────────────────────────────────────────────────
const { processUploadedFile } = require("./processing/processFile");
const { processSection } = require("./processing/processSection");
const { processDocumentBatch } = require("./processing/processDocumentBatch");

// ── Scheduling ───────────────────────────────────────────────────────────────
const { generateSchedule } = require("./scheduling/generateSchedule");
const { regenSchedule } = require("./scheduling/regenSchedule");
const { catchUp } = require("./scheduling/catchUp");

// ── Questions ────────────────────────────────────────────────────────────────
const { generateQuestions } = require("./questions/generateQuestions");
const { getQuiz } = require("./questions/getQuiz");

// ── Analytics ────────────────────────────────────────────────────────────────
const { submitAttempt } = require("./analytics/submitAttempt");
const { computeWeakness } = require("./analytics/computeWeakness");

// ── Admin ────────────────────────────────────────────────────────────────────
const { deleteUserData } = require("./admin/deleteUserData");
const { healthCheck } = require("./admin/healthCheck");

// ── Exports ──────────────────────────────────────────────────────────────────
exports.processUploadedFile = processUploadedFile;
exports.processSection = processSection;
exports.processDocumentBatch = processDocumentBatch;
exports.generateSchedule = generateSchedule;
exports.regenSchedule = regenSchedule;
exports.catchUp = catchUp;
exports.generateQuestions = generateQuestions;
exports.getQuiz = getQuiz;
exports.submitAttempt = submitAttempt;
exports.computeWeakness = computeWeakness;
exports.deleteUserData = deleteUserData;
exports.healthCheck = healthCheck;
