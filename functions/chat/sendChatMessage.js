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

function chatUserPrompt({ message, sectionContext, threadHistory }) {
  let prompt = "";

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

    const { threadId, message, courseId } = data;

    if (!threadId || !message || !courseId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "threadId, message, and courseId are required."
      );
    }

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
        .map((d) => d.data())
        .reverse()
        .filter((m) => m.content !== message); // exclude the message we just saved

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
          if (bp.learningObjectives) parts.push("Objectives: " + bp.learningObjectives.join("; "));
          if (bp.keyConcepts) parts.push("Key concepts: " + bp.keyConcepts.join("; "));
          if (bp.highYieldPoints) parts.push("High-yield: " + bp.highYieldPoints.join("; "));
          if (bp.commonTraps) parts.push("Common traps: " + bp.commonTraps.join("; "));
          if (bp.termsToDefine) parts.push("Key terms: " + bp.termsToDefine.join("; "));
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
        console.warn("Could not fetch section context:", err.message);
      }

      // Call Claude for response
      const userPrompt = chatUserPrompt({ message, sectionContext, threadHistory });
      const result = await callClaude(CHAT_SYSTEM, userPrompt, "HEAVY", 2048);

      let responseText = "I'm sorry, I couldn't generate a response. Please try again.";
      let citations = [];

      if (result.success && result.data) {
        responseText = result.data.response || responseText;
        citations = result.data.citations || [];
      } else {
        console.error("AI call failed:", result.error);
      }

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
          .update({
            lastMessage: responseText.slice(0, 100),
            messageCount: admin.firestore.FieldValue.increment(2),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (threadErr) {
        console.warn("Could not update thread metadata:", threadErr.message);
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
      console.error("sendChatMessage error:", err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to process your message. Please try again."
      );
    }
  });
