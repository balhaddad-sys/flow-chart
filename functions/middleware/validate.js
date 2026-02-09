const functions = require("firebase-functions");

/**
 * Input validation helpers for Cloud Functions.
 * Throws HttpsError with descriptive messages on invalid input.
 */

/**
 * Require authenticated user. Returns uid.
 * @param {object} context - Cloud Functions call context
 * @returns {string} uid
 */
function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return context.auth.uid;
}

/**
 * Validate that required string fields are present and within length limits.
 * @param {object} data - Input data object
 * @param {Array<{field: string, maxLen?: number}>} fields - Required fields
 */
function requireStrings(data, fields) {
  for (const { field, maxLen } of fields) {
    const value = data[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `${field} is required and must be a non-empty string.`
      );
    }
    if (maxLen && value.length > maxLen) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `${field} must be at most ${maxLen} characters.`
      );
    }
  }
}

/**
 * Validate that a field is a positive integer within bounds.
 * @param {object} data - Input data object
 * @param {string} field - Field name
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {number} [defaultValue] - Default if field is undefined
 * @returns {number} Validated integer
 */
function requireInt(data, field, min, max, defaultValue) {
  let value = data[field];
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) return defaultValue;
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} is required.`
    );
  }
  value = Number(value);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} must be an integer between ${min} and ${max}.`
    );
  }
  return value;
}

/**
 * Sanitize error for client response. Never leak stack traces or internal paths.
 * @param {Error} error - The caught error
 * @param {string} operation - Human-readable operation name
 * @returns {object} Safe error response
 */
function safeError(error, operation) {
  console.error(`${operation} error:`, error);

  // Map known error types to user-friendly messages
  if (error.code === "permission-denied" || error.code === "PERMISSION_DENIED") {
    return {
      success: false,
      error: { code: "PERMISSION_DENIED", message: "You do not have permission to perform this action." },
    };
  }
  if (error.code === "not-found" || error.code === "NOT_FOUND") {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "The requested resource was not found." },
    };
  }

  // Generic fallback — never expose internal error messages to client
  return {
    success: false,
    error: {
      code: "INTERNAL",
      message: `An error occurred during ${operation}. Please try again.`,
    },
  };
}

module.exports = {
  requireAuth,
  requireStrings,
  requireInt,
  safeError,
};
