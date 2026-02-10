/**
 * @module lib/logger
 * @description Structured JSON logger for MedQ Cloud Functions.
 *
 * Wraps `console.*` with structured payloads so that Cloud Logging can index
 * fields like `severity`, `function`, `uid`, and `duration`.  Every log entry
 * is a single JSON line for easy parsing in production dashboards.
 *
 * @example
 *   const log = require("../lib/logger");
 *   log.info("Schedule generated", { uid, courseId, taskCount: 42 });
 *   log.warn("Rate limit fallback", { uid, operation });
 *   log.error("Blueprint failed", { sectionId, error: err.message });
 */

/**
 * @typedef {"DEBUG"|"INFO"|"WARN"|"ERROR"} Severity
 */

/**
 * Emit a structured log entry.
 *
 * @param {Severity} severity
 * @param {string}   message
 * @param {object}   [fields] - Arbitrary key-value context.
 */
function emit(severity, message, fields = {}) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  switch (severity) {
    case "ERROR":
      console.error(JSON.stringify(entry));
      break;
    case "WARN":
      console.warn(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
      break;
  }
}

/** @param {string} message @param {object} [fields] */
function debug(message, fields) { emit("DEBUG", message, fields); }

/** @param {string} message @param {object} [fields] */
function info(message, fields) { emit("INFO", message, fields); }

/** @param {string} message @param {object} [fields] */
function warn(message, fields) { emit("WARN", message, fields); }

/** @param {string} message @param {object} [fields] */
function error(message, fields) { emit("ERROR", message, fields); }

module.exports = { debug, info, warn, error };
