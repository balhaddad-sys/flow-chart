const admin = require("firebase-admin");

admin.initializeApp();

// Processing pipeline
const { processUploadedFile } = require("./processing/processFile");
const { processSection } = require("./processing/processSection");

// Scheduling
const { generateSchedule } = require("./scheduling/generateSchedule");
const { regenSchedule } = require("./scheduling/regenSchedule");
const { catchUp } = require("./scheduling/catchUp");

// Questions
const { generateQuestions } = require("./questions/generateQuestions");
const { getQuiz } = require("./questions/getQuiz");

// Analytics
const { submitAttempt } = require("./analytics/submitAttempt");
const { computeWeakness } = require("./analytics/computeWeakness");

// Admin
const { deleteUserData } = require("./admin/deleteUserData");
const { healthCheck } = require("./admin/healthCheck");

// Export all functions
exports.processUploadedFile = processUploadedFile;
exports.processSection = processSection;
exports.generateSchedule = generateSchedule;
exports.regenSchedule = regenSchedule;
exports.catchUp = catchUp;
exports.generateQuestions = generateQuestions;
exports.getQuiz = getQuiz;
exports.submitAttempt = submitAttempt;
exports.computeWeakness = computeWeakness;
exports.deleteUserData = deleteUserData;
exports.healthCheck = healthCheck;
