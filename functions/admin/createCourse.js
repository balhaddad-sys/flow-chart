/**
 * @module admin/createCourse
 * @description Callable function that creates a new course for the user.
 *
 * @param {Object} data
 * @param {string} data.title     - Course title.
 * @param {string} [data.examDate]  - ISO date string (YYYY-MM-DD) for the exam.
 * @param {string} [data.examType]  - Exam type label (e.g. "USMLE Step 1").
 * @returns {{ success: true, data: { courseId: string } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");

exports.createCourse = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "title", maxLen: 200 }]);

  try {
    const { title, examDate, examType } = data;

    // Parse exam date if provided
    let parsedExamDate = null;
    if (examDate) {
      const date = new Date(examDate);
      if (isNaN(date.getTime())) {
        return fail(Errors.INVALID_ARGUMENT, "examDate must be a valid date string.");
      }
      parsedExamDate = admin.firestore.Timestamp.fromDate(date);
    }

    // Check for duplicate course title
    const existingSnap = await db
      .collection(`users/${uid}/courses`)
      .where("title", "==", title.trim())
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return fail(Errors.ALREADY_EXISTS, "A course with this title already exists.");
    }

    // Create the course document
    const courseRef = db.collection(`users/${uid}/courses`).doc();
    const courseData = {
      title: title.trim(),
      examType: examType || null,
      examDate: parsedExamDate,
      status: "ACTIVE",
      fileCount: 0,
      sectionCount: 0,
      questionCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await courseRef.set(courseData);

    log.info("Course created", { uid, courseId: courseRef.id, title: title.trim() });

    return ok({ courseId: courseRef.id });
  } catch (error) {
    return safeError(error, "course creation");
  }
});
