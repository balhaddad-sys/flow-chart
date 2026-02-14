/**
 * @module admin/createCourse
 * @description Callable function that creates a new course for the user.
 *
 * @param {Object} data
 * @param {string} data.title     - Course title.
 * @param {string} [data.examDate]  - ISO date string (YYYY-MM-DD) for the exam.
 * @param {string} [data.examType]  - Exam type label (e.g. "USMLE Step 1").
 * @param {string[]} [data.tags]  - Topic tags for the course.
 * @param {Object} [data.availability] - Study time availability settings.
 * @param {number} [data.availability.defaultMinutesPerDay] - Default daily study minutes.
 * @param {string[]} [data.availability.excludedDates] - ISO dates to exclude.
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
    const { title, examDate, examType, tags, availability } = data;

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

    // Validate and sanitize tags (max 20 tags, each max 50 chars)
    let sanitizedTags = [];
    if (Array.isArray(tags)) {
      sanitizedTags = tags
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().substring(0, 50))
        .slice(0, 20);
    }

    // Validate and sanitize availability
    // Supports two formats:
    //   1. Per-day: { monday: 120, tuesday: 90, ... } (from onboarding)
    //   2. Legacy:  { defaultMinutesPerDay: 120, excludedDates: [] }
    const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    let sanitizedAvailability = {
      defaultMinutesPerDay: 120,
      perDayOverrides: {},
      excludedDates: [],
    };
    if (availability && typeof availability === "object") {
      // Check for per-day format (keys are weekday names)
      const hasPerDay = WEEKDAYS.some((d) => typeof availability[d] === "number");
      if (hasPerDay) {
        let total = 0;
        let count = 0;
        for (const day of WEEKDAYS) {
          if (typeof availability[day] === "number") {
            const mins = Math.max(0, Math.min(480, Math.floor(availability[day])));
            sanitizedAvailability.perDayOverrides[day] = mins;
            total += mins;
            count++;
          }
        }
        sanitizedAvailability.defaultMinutesPerDay = count > 0 ? Math.round(total / count) : 120;
      } else if (typeof availability.defaultMinutesPerDay === "number") {
        sanitizedAvailability.defaultMinutesPerDay = Math.max(
          15,
          Math.min(480, Math.floor(availability.defaultMinutesPerDay))
        );
      }
      if (Array.isArray(availability.excludedDates)) {
        sanitizedAvailability.excludedDates = availability.excludedDates
          .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .slice(0, 365);
      }
    }

    // Create the course document
    const courseRef = db.collection(`users/${uid}/courses`).doc();
    const courseData = {
      title: title.trim(),
      examType: examType || null,
      examDate: parsedExamDate,
      status: "ACTIVE",
      tags: sanitizedTags,
      availability: sanitizedAvailability,
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
