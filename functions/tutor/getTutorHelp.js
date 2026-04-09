const admin = require("firebase-admin");
const db = admin.firestore();
const { getTutorResponse } = require("../ai/freeAIClient");
const { tutorPrompt } = require("../ai/prompts");

/**
 * Get AI-powered tutoring help for a specific question attempt.
 * Expects: { questionId, attemptId }
 * Returns: { success: true, data: { explanation, hints, keyConcepts } }
 */
async function getTutorHelp(data, context) {
  // Validate authentication
  if (!context.auth) {
    return {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "You must be logged in to get tutoring help.",
      },
    };
  }

  const uid = context.auth.uid;
  const { questionId, attemptId } = data;

  // Validate input
  if (!questionId || typeof questionId !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "questionId is required and must be a string.",
      },
    };
  }

  if (!attemptId || typeof attemptId !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "attemptId is required and must be a string.",
      },
    };
  }

  try {
    // Fetch the question
    const questionRef = db.collection("questions").doc(questionId);
    const questionSnap = await questionRef.get();

    if (!questionSnap.exists) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Question not found.",
        },
      };
    }

    const question = questionSnap.data();

    // Verify ownership
    if (question.userId !== uid) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You don't have access to this question.",
        },
      };
    }

    // Fetch the attempt
    const attemptRef = db.collection("attempts").doc(attemptId);
    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Attempt not found.",
        },
      };
    }

    const attempt = attemptSnap.data();

    // Verify attempt belongs to user
    if (attempt.userId !== uid) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You don't have access to this attempt.",
        },
      };
    }

    // Build prompt for AI tutor
    const userPrompt = `
Question: ${question.text}
Options:
${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}
Correct Answer: ${String.fromCharCode(65 + question.correctIndex)}
User's Answer: ${String.fromCharCode(65 + attempt.answerIndex)}
Time Spent: ${attempt.timeSpentSec} seconds
Confidence: ${attempt.confidence || "not provided"}
Was Correct: ${attempt.answerIndex === question.correctIndex}

Please provide:
1. A clear explanation of why the correct answer is right
2. Why the user's answer was wrong (if incorrect)
3. Key concepts to remember
4. 2-3 hints for similar questions
`;

    // Call AI for tutoring response
    const aiResult = await getTutorResponse(tutorPrompt, userPrompt);

    if (!aiResult.success) {
      console.error("AI tutoring failed:", aiResult.error);
      return {
        success: false,
        error: {
          code: "AI_ERROR",
          message: "Failed to generate tutoring response. Please try again.",
        },
      };
    }

    const tutorData = aiResult.data;

    // Save tutoring session to Firestore
    const tutoringRef = db.collection("tutoring").doc();
    await tutoringRef.set({
      userId: uid,
      questionId,
      attemptId,
      explanation: tutorData.explanation || "",
      hints: tutorData.hints || [],
      keyConcepts: tutorData.keyConcepts || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      data: {
        tutoringId: tutoringRef.id,
        explanation: tutorData.explanation || "",
        hints: tutorData.hints || [],
        keyConcepts: tutorData.keyConcepts || [],
      },
    };
  } catch (error) {
    console.error("Error getting tutor help:", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get tutoring help. Please try again.",
      },
    };
  }
}

module.exports = { getTutorHelp };
