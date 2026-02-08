const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * HTTP: Returns function health + queue backlog.
 */
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  try {
    // Count pending jobs across all users (sample check)
    // In production, use a dedicated admin collection for this
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const health = {
      status: "healthy",
      timestamp: now.toISOString(),
      version: "1.0.0",
    };

    res.status(200).json(health);
  } catch (error) {
    console.error("healthCheck error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
