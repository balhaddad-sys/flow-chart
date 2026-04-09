const admin = require("firebase-admin");
const db = admin.firestore();
const { generateFixPlan: generateFixPlanAI } = require("../ai/freeAIClient");
const { fixPlanPrompt } = require("../ai/prompts");

/**
 * Generate a personalized study plan to address weak areas.
 * Expects: { courseId }
 * Returns: { success: true, data: { planId, tasks, focusAreas, estimatedHours } }
 */
async function runFixPlan(data, context) {
  // Validate authentication
  if (!context.auth) {
    return {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "You must be logged in to generate a fix plan.",
      },
    };
  }

  const uid = context.auth.uid;
  const { courseId } = data;

  // Validate input
  if (!courseId || typeof courseId !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "courseId is required and must be a string.",
      },
    };
  }

  try {
    // Fetch the course
    const courseRef = db.collection("courses").doc(courseId);
    const courseSnap = await courseRef.get();

    if (!courseSnap.exists) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Course not found.",
        },
      };
    }

    const course = courseSnap.data();

    // Verify ownership
    if (course.userId !== uid) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You don't have access to this course.",
        },
      };
    }

    // Fetch user's performance data
    const attemptsSnapshot = await db
      .collection("attempts")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const attempts = [];
    const topicPerformance = {};
    let totalCorrect = 0;
    let totalAttempts = attemptsSnapshot.size;

    attemptsSnapshot.forEach((doc) => {
      const attempt = { id: doc.id, ...doc.data() };
      attempts.push(attempt);

      if (attempt.answerIndex === attempt.correctIndex) {
        totalCorrect++;
      }

      // Track performance by topic
      const topic = attempt.topicTag || "general";
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { correct: 0, total: 0 };
      }
      topicPerformance[topic].total++;
      if (attempt.answerIndex === attempt.correctIndex) {
        topicPerformance[topic].correct++;
      }
    });

    // Calculate weakness scores
    const weakTopics = Object.entries(topicPerformance)
      .map(([topic, stats]) => ({
        topic,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
        attempts: stats.total,
      }))
      .filter((t) => t.attempts >= 2) // Need minimum data
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5); // Top 5 weakest areas

    // Build prompt for AI fix plan
    const userPrompt = `
Overall Performance: ${totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0}% correct (${totalCorrect}/${totalAttempts})

Weak Areas (sorted by accuracy):
${weakTopics.map((t) => `- ${t.topic}: ${(t.accuracy * 100).toFixed(1)}% correct (${t.attempts} questions)`).join("\n")}

Please create a focused study plan that includes:
1. Priority order of topics to study
2. Specific tasks for each weak area
3. Estimated time needed per topic
4. Recommended question counts for practice
5. Quick wins vs long-term focus areas

Return as JSON with structure:
{
  "focusAreas": [{ "topic": "...", "priority": 1-5, "accuracy": number, "reason": "..." }],
  "tasks": [{ "title": "...", "topic": "...", "estimatedMinutes": number, "description": "..." }],
  "estimatedTotalHours": number,
  "summary": "brief overview"
}
`;

    // Call AI for fix plan
    const aiResult = await generateFixPlanAI(fixPlanPrompt, userPrompt);

    if (!aiResult.success) {
      console.error("AI fix plan generation failed:", aiResult.error);
      
      // Return a basic plan without AI if AI fails
      const basicPlan = {
        focusAreas: weakTopics.map((t, i) => ({
          topic: t.topic,
          priority: i + 1,
          accuracy: t.accuracy,
          reason: `Low accuracy of ${(t.accuracy * 100).toFixed(1)}%`,
        })),
        tasks: weakTopics.slice(0, 3).map((t) => ({
          title: `Practice ${t.topic}`,
          topic: t.topic,
          estimatedMinutes: 30,
          description: `Complete 10-15 questions on ${t.topic}`,
        })),
        estimatedTotalHours: Math.max(1, weakTopics.length * 0.5),
        summary: `Focus on your ${weakTopics.length} weakest areas first.`,
      };

      const planRef = db.collection("fixPlans").doc();
      await planRef.set({
        userId: uid,
        courseId,
        ...basicPlan,
        generatedBy: "basic",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: {
          planId: planRef.id,
          ...basicPlan,
        },
      };
    }

    const planData = aiResult.data;

    // Save fix plan to Firestore
    const planRef = db.collection("fixPlans").doc();
    await planRef.set({
      userId: uid,
      courseId,
      focusAreas: planData.focusAreas || [],
      tasks: planData.tasks || [],
      estimatedTotalHours: planData.estimatedTotalHours || 0,
      summary: planData.summary || "",
      generatedBy: "ai",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      data: {
        planId: planRef.id,
        focusAreas: planData.focusAreas || [],
        tasks: planData.tasks || [],
        estimatedTotalHours: planData.estimatedTotalHours || 0,
        summary: planData.summary || "",
      },
    };
  } catch (error) {
    console.error("Error generating fix plan:", error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate fix plan. Please try again.",
      },
    };
  }
}

module.exports = { runFixPlan };
