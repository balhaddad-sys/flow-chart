/**
 * @module chat/sendChatMessage
 * @description Cloud Function for AI study assistant chat.
 *
 * Uses Claude Opus for accurate medical Q&A with section context.
 * Stores messages in Firestore and returns AI response with citations.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { callClaude } = require("../ai/aiClient");
const { defineSecret } = require("firebase-functions/params");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const log = require("../lib/logger");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const CHAT_SYSTEM = `You are MedQ AI Study Assistant, a helpful and accurate medical education tutor.
You help medical students understand their course material by answering questions,
explaining concepts, and providing clinical context.

Rules:
- Be accurate and evidence-based. If unsure, say so.
- Reference the provided study material when relevant.
- Keep explanations clear and concise, suitable for medical students.
- When citing material, reference the section title.
- Output STRICT JSON only.`;

const MAX_THREAD_ID_LEN = 128;
const MAX_COURSE_ID_LEN = 128;
const MAX_MESSAGE_LEN = 2000;
const ALLOWED_DETAIL_LEVELS = new Set(["brief", "standard", "deep"]);

function normaliseTrimmedString(value, field, maxLen) {
  if (typeof value !== "string") {
    throw new functions.https.HttpsError("invalid-argument", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new functions.https.HttpsError("invalid-argument", `${field} is required.`);
  }
  if (trimmed.length > maxLen) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} must be at most ${maxLen} characters.`
    );
  }
  return trimmed;
}

function normaliseDetailLevel(value) {
  const normalised = String(value || "standard").trim().toLowerCase();
  return ALLOWED_DETAIL_LEVELS.has(normalised) ? normalised : "standard";
}

function normaliseLearnerLevel(value) {
  const text = String(value || "medical student").trim();
  if (!text) return "medical student";
  return text.slice(0, 80);
}

function chatUserPrompt({
  message,
  sectionContext,
  threadHistory,
  detailLevel,
  learnerLevel,
  clinicallyNuanced,
  examName,
}) {
  let prompt = "";

  prompt += "Tutor configuration:\n";
  prompt += `- Learner level: ${learnerLevel}\n`;
  prompt += `- Explanation depth: ${detailLevel}\n`;
  prompt += `- Clinically nuanced mode: ${clinicallyNuanced ? "enabled" : "disabled"}\n`;
  if (examName) {
    prompt += `- Target exam: ${examName}\n`;
  }
  prompt += "\n";

  if (threadHistory && threadHistory.length > 0) {
    prompt += "Previous conversation:\n";
    for (const msg of threadHistory.slice(-6)) {
      prompt += `${msg.role === "user" ? "Student" : "Assistant"}: ${msg.content}\n`;
    }
    prompt += "\n";
  }

  if (sectionContext && sectionContext.length > 0) {
    prompt += "Relevant study material:\n";
    for (const sec of sectionContext) {
      prompt += `--- Section: "${sec.title}" ---\n${sec.text}\n\n`;
    }
  }

  prompt += `Student's question: ${message}

Return this exact JSON schema:
{
  "response": "string — your helpful answer",
  "citations": [
    {
      "sectionTitle": "string — title of the referenced section",
      "relevance": "string — brief note on why this section is relevant"
    }
  ]
}`;

  return prompt;
}

exports.sendChatMessage = functions
  .runWith({
    secrets: [anthropicApiKey],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = context.auth.uid;

    await checkRateLimit(uid, "sendChatMessage", RATE_LIMITS.sendChatMessage);

    const threadId = normaliseTrimmedString(data?.threadId, "threadId", MAX_THREAD_ID_LEN);
    const message = normaliseTrimmedString(data?.message, "message", MAX_MESSAGE_LEN);
    const courseId = normaliseTrimmedString(data?.courseId, "courseId", MAX_COURSE_ID_LEN);
    const detailLevel = normaliseDetailLevel(data?.detailLevel);
    const learnerLevel = normaliseLearnerLevel(data?.learnerLevel);
    const examName = typeof data?.examName === "string" ? data.examName.trim().slice(0, 80) : "";
    const clinicallyNuanced = Boolean(data?.clinicallyNuanced);

    try {
      // Save user message
      const userMsgRef = await db
        .collection("users")
        .doc(uid)
        .collection("chatMessages")
        .add({
          threadId,
          role: "user",
          content: message,
          citations: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Get recent thread history
      const historySnap = await db
        .collection("users")
        .doc(uid)
        .collection("chatMessages")
        .where("threadId", "==", threadId)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      const threadHistory = historySnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .reverse()
        .filter((m) => m.id !== userMsgRef.id); // exclude the message we just saved

      // Get ALL analyzed section context from the course
      let sectionContext = [];
      try {
        const sectionsSnap = await db
          .collection("users")
          .doc(uid)
          .collection("sections")
          .where("courseId", "==", courseId)
          .where("aiStatus", "==", "ANALYZED")
          .get();

        sectionContext = sectionsSnap.docs.map((d) => {
          const secData = d.data();
          const bp = secData.blueprint || {};
          const parts = [];
          if (Array.isArray(bp.learningObjectives)) {
            parts.push("Objectives: " + bp.learningObjectives.join("; "));
          }
          if (Array.isArray(bp.keyConcepts)) {
            parts.push("Key concepts: " + bp.keyConcepts.join("; "));
          }
          if (Array.isArray(bp.highYieldPoints)) {
            parts.push("High-yield: " + bp.highYieldPoints.join("; "));
          }
          if (Array.isArray(bp.commonTraps)) {
            parts.push("Common traps: " + bp.commonTraps.join("; "));
          }
          if (Array.isArray(bp.termsToDefine)) {
            parts.push("Key terms: " + bp.termsToDefine.join("; "));
          }
          return {
            title: bp.title || secData.title || "Untitled",
            text: parts.join("\n").slice(0, 800),
          };
        });

        // Cap total context to ~6000 chars to stay within token limits
        let totalChars = 0;
        sectionContext = sectionContext.filter((s) => {
          totalChars += s.title.length + s.text.length;
          return totalChars < 6000;
        });
      } catch (err) {
        log.warn("Could not fetch section context", { uid, courseId, error: err.message });
      }

      // Route nuanced cases to HEAVY tier. Today both tiers use Haiku in aiClient,
      // but this keeps routing explicit if model mappings diverge later.
      const tier = clinicallyNuanced ? "HEAVY" : "LIGHT";
      const userPrompt = chatUserPrompt({
        message,
        sectionContext,
        threadHistory,
        detailLevel,
        learnerLevel,
        clinicallyNuanced,
        examName,
      });
      const result = await callClaude(CHAT_SYSTEM, userPrompt, tier, 2048);
      if (!result.success || !result.data || typeof result.data.response !== "string") {
        log.error("AI call failed", {
          uid,
          threadId,
          courseId,
          tier,
          error: result.error || "Malformed AI response",
        });
        throw new Error("AI response unavailable");
      }
      const responseText = result.data.response.trim();
      const citations = Array.isArray(result.data.citations)
        ? result.data.citations
            .filter((c) => c && typeof c.sectionTitle === "string")
            .slice(0, 6)
            .map((c) => ({
              sectionTitle: String(c.sectionTitle).trim().slice(0, 120),
              relevance: String(c.relevance || "").trim().slice(0, 240),
            }))
        : [];

      // Save assistant message
      await db
        .collection("users")
        .doc(uid)
        .collection("chatMessages")
        .add({
          threadId,
          role: "assistant",
          content: responseText,
          citations,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update thread metadata
      try {
        await db
          .collection("users")
          .doc(uid)
          .collection("chatThreads")
          .doc(threadId)
          .set({
            lastMessage: responseText.slice(0, 100),
            messageCount: admin.firestore.FieldValue.increment(2),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
      } catch (threadErr) {
        log.warn("Could not update thread metadata", {
          uid,
          threadId,
          error: threadErr.message,
        });
      }

      return {
        success: true,
        data: {
          userMessageId: userMsgRef.id,
          response: responseText,
          citations,
        },
      };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      log.error("sendChatMessage failed", {
        uid,
        errorCode: err.code || null,
        errorMessage: err.message,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to process your message. Please try again."
      );
    }
  });
