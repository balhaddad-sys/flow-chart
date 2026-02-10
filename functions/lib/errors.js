/**
 * @module lib/errors
 * @description Centralised error code registry for MedQ Cloud Functions.
 *
 * Every user-facing error code is defined here with a stable string identifier
 * and a default human-readable message.  Factory helpers produce the
 * standardised `{ success: false, error: { code, message } }` response
 * envelope so that clients can switch on `error.code` reliably.
 *
 * @example
 *   const { Errors, fail } = require("../lib/errors");
 *   return fail(Errors.NOT_FOUND, "Course not found.");
 */

// ── Error code catalogue ─────────────────────────────────────────────────────

/**
 * @typedef {Object} ErrorEntry
 * @property {string} code   - Stable machine-readable identifier.
 * @property {string} message - Default human-readable description.
 */

/** @type {Record<string, ErrorEntry>} */
const Errors = Object.freeze({
  // Auth / permissions
  UNAUTHENTICATED:    { code: "UNAUTHENTICATED",    message: "Authentication required." },
  PERMISSION_DENIED:  { code: "PERMISSION_DENIED",   message: "You do not have permission to perform this action." },

  // Client errors
  INVALID_ARGUMENT:   { code: "INVALID_ARGUMENT",    message: "One or more arguments are invalid." },
  NOT_FOUND:          { code: "NOT_FOUND",            message: "The requested resource was not found." },
  ALREADY_EXISTS:     { code: "ALREADY_EXISTS",       message: "This resource already exists." },
  NOT_ANALYZED:       { code: "NOT_ANALYZED",         message: "Section must be analyzed before this operation." },
  NO_SECTIONS:        { code: "NO_SECTIONS",          message: "No analyzed sections found. Upload and process files first." },

  // Server / infra
  AI_FAILED:          { code: "AI_FAILED",            message: "AI processing failed. Please try again." },
  RATE_LIMITED:       { code: "RATE_LIMITED",          message: "Too many requests. Please wait and try again." },
  TIMEOUT:            { code: "TIMEOUT",               message: "The operation took too long. Please try again." },
  UNAVAILABLE:        { code: "UNAVAILABLE",           message: "Service temporarily unavailable. Please try again later." },
  INTERNAL:           { code: "INTERNAL",              message: "An internal error occurred. Please try again." },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a standardised failure envelope.
 *
 * @param {ErrorEntry} entry - An entry from {@link Errors}.
 * @param {string}     [message] - Optional override for the default message.
 * @returns {{ success: false, error: { code: string, message: string } }}
 */
function fail(entry, message) {
  return {
    success: false,
    error: { code: entry.code, message: message || entry.message },
  };
}

/**
 * Build a standardised success envelope.
 *
 * @template T
 * @param {T} data
 * @returns {{ success: true, data: T }}
 */
function ok(data) {
  return { success: true, data };
}

// ── Firestore / gRPC error code mapping ──────────────────────────────────────

/** @private Maps upstream error codes to our registry entries. */
const UPSTREAM_MAP = [
  { codes: ["permission-denied", "PERMISSION_DENIED"], entry: Errors.PERMISSION_DENIED },
  { codes: ["not-found", "NOT_FOUND"],                 entry: Errors.NOT_FOUND },
  { codes: ["already-exists", "ALREADY_EXISTS"],        entry: Errors.ALREADY_EXISTS },
  { codes: ["resource-exhausted", "RESOURCE_EXHAUSTED"],entry: Errors.RATE_LIMITED },
  { codes: ["unavailable", "UNAVAILABLE"],              entry: Errors.UNAVAILABLE },
  { codes: ["deadline-exceeded", "DEADLINE_EXCEEDED"],   entry: Errors.TIMEOUT },
];

/**
 * Normalise a caught error into a client-safe failure envelope.
 * Internal details are logged server-side but never exposed to the caller.
 *
 * @param {Error}  error
 * @param {string} operation - Human-readable label (e.g. "schedule generation").
 * @returns {{ success: false, error: { code: string, message: string } }}
 */
function safeError(error, operation) {
  const logger = require("./logger");
  logger.error(`${operation} failed`, { operation, errorCode: error.code, errorMessage: error.message });

  for (const mapping of UPSTREAM_MAP) {
    if (mapping.codes.includes(error.code)) {
      return fail(mapping.entry);
    }
  }

  return fail(Errors.INTERNAL, `An error occurred during ${operation}. Please try again.`);
}

module.exports = { Errors, fail, ok, safeError };
