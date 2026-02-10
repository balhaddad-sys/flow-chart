/**
 * @module middleware/validate
 * @description Input validation helpers for Cloud Functions callable endpoints.
 *
 * Each helper throws `functions.https.HttpsError` with a descriptive message
 * on invalid input, short-circuiting the request before any business logic
 * runs.  `safeError` normalises caught errors into a client-safe envelope
 * that never leaks stack traces or internal paths.
 */

const functions = require("firebase-functions");

/**
 * Require an authenticated caller.
 *
 * @param {functions.https.CallableContext} context
 * @returns {string} The authenticated user's UID.
 * @throws {functions.https.HttpsError} `unauthenticated` if no auth context.
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
 *
 * @param {object} data - Callable input data.
 * @param {Array<{ field: string, maxLen?: number }>} fields
 * @throws {functions.https.HttpsError} `invalid-argument` on first violation.
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
 * Validate that a field is an integer within bounds.
 *
 * @param {object} data - Callable input data.
 * @param {string} field - Field name.
 * @param {number} min - Minimum value (inclusive).
 * @param {number} max - Maximum value (inclusive).
 * @param {number} [defaultValue] - Returned when the field is absent.
 * @returns {number} The validated integer.
 * @throws {functions.https.HttpsError} `invalid-argument` on violation.
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

/** @private Map of Firestore/gRPC error codes to client-friendly responses. */
const ERROR_MAP = [
  { codes: ["permission-denied", "PERMISSION_DENIED"], out: { code: "PERMISSION_DENIED", message: "You do not have permission to perform this action." } },
  { codes: ["not-found", "NOT_FOUND"], out: { code: "NOT_FOUND", message: "The requested resource was not found." } },
  { codes: ["already-exists", "ALREADY_EXISTS"], out: { code: "ALREADY_EXISTS", message: "This resource already exists." } },
  { codes: ["resource-exhausted", "RESOURCE_EXHAUSTED"], out: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." } },
  { codes: ["unavailable", "UNAVAILABLE"], out: { code: "UNAVAILABLE", message: "Service temporarily unavailable. Please try again later." } },
  { codes: ["deadline-exceeded", "DEADLINE_EXCEEDED"], out: { code: "TIMEOUT", message: "The operation took too long. Please try again." } },
];

/**
 * Normalise a caught error into a client-safe response envelope.
 * Internal details are logged server-side but never returned to the caller.
 *
 * @param {Error} error
 * @param {string} operation - Human-readable label (e.g. "schedule generation").
 * @returns {{ success: false, error: { code: string, message: string } }}
 */
function safeError(error, operation) {
  console.error(`${operation} error:`, error);

  for (const entry of ERROR_MAP) {
    if (entry.codes.includes(error.code)) {
      return { success: false, error: entry.out };
    }
  }

  return {
    success: false,
    error: {
      code: "INTERNAL",
      message: `An error occurred during ${operation}. Please try again.`,
    },
  };
}

module.exports = { requireAuth, requireStrings, requireInt, safeError };
