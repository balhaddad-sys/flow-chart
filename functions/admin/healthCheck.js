const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();
const APP_VERSION = require("../package.json").version;

/**
 * HTTP: Returns function health status.
 * Performs lightweight Firestore connectivity check.
 */
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const checks = {
    firestore: "unknown",
  };

  try {
    const start = Date.now();
    await db.collection("_health").doc("ping").set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    checks.firestore = `ok (${Date.now() - start}ms)`;

    res.status(200).json({
      status: "healthy",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    console.error("healthCheck error:", error);
    checks.firestore = "failed";

    res.status(503).json({
      status: "degraded",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks,
    });
  }
});
