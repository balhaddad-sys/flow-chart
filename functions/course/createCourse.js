const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * Create a new course for the authenticated user.
 * Expects: { title, examDate?, examType? }
 * Returns: { success: true, data: { courseId, title, createdAt } }
 */
async function createCourse(data, context) {
  // Validate authentication
  if (!context.auth) {
    return {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "You must be logged in to create a course.",
      },
    };
  }

  const uid = context.auth.uid;

  // Validate input
  const { title, examDate, examType } = data;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Course title is required and must be a non-empty string.",
      },
    };
  }

  try {
    const courseRef = db.collection("courses").doc();
    const courseId = courseRef.id;

    await courseRef.set({
      userId: uid,
      title: title.trim(),
      examDate: examDate || null,
      examType: examType || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
      sections: [],
      totalQuestions: 0,
      completedQuestions: 0,
    });

    return {
      success: true,
      data: {
        courseId,
        title: title.trim(),
        examDate,
        examType,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error creating course:", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create course. Please try again.",
      },
    };
  }
}

module.exports = { createCourse };
