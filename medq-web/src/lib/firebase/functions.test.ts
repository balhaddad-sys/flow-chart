/**
 * @file functions.test.ts
 * @description Tests for the Firebase function wrapper — validates error
 * classification, retry logic detection, and type exports.
 */

// Mock the Firebase client module to prevent SDK initialization in test
jest.mock("./client", () => ({
  functions: {},
}));

// Mock firebase/functions to prevent real httpsCallable setup
jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

import { CloudFunctionError } from "./functions";

describe("CloudFunctionError", () => {
  describe("Transient error detection", () => {
    it("classifies unavailable as transient", () => {
      const err = new CloudFunctionError("unavailable", "Service unavailable");
      expect(err.isTransient).toBe(true);
      expect(err.code).toBe("unavailable");
      expect(err.message).toBe("Service unavailable");
      expect(err.name).toBe("CloudFunctionError");
    });

    it("classifies deadline-exceeded as transient", () => {
      const err = new CloudFunctionError("deadline-exceeded", "Timeout");
      expect(err.isTransient).toBe(true);
    });

    it("classifies resource-exhausted as transient", () => {
      const err = new CloudFunctionError("resource-exhausted", "Rate limited");
      expect(err.isTransient).toBe(true);
    });

    it("classifies internal as transient", () => {
      const err = new CloudFunctionError("internal", "Server error");
      expect(err.isTransient).toBe(true);
    });

    it("classifies RATE_LIMIT as transient", () => {
      const err = new CloudFunctionError("RATE_LIMIT", "Too many requests");
      expect(err.isTransient).toBe(true);
    });

    it("classifies UNAVAILABLE as transient", () => {
      const err = new CloudFunctionError("UNAVAILABLE", "Try again");
      expect(err.isTransient).toBe(true);
    });
  });

  describe("Non-transient errors", () => {
    it("classifies NOT_FOUND as non-transient", () => {
      const err = new CloudFunctionError("NOT_FOUND", "Resource not found");
      expect(err.isTransient).toBe(false);
    });

    it("classifies INVALID_ARGUMENT as non-transient", () => {
      const err = new CloudFunctionError("INVALID_ARGUMENT", "Bad input");
      expect(err.isTransient).toBe(false);
    });

    it("classifies PERMISSION_DENIED as non-transient", () => {
      const err = new CloudFunctionError("PERMISSION_DENIED", "Unauthorized");
      expect(err.isTransient).toBe(false);
    });

    it("classifies UNAUTHENTICATED as non-transient", () => {
      const err = new CloudFunctionError("UNAUTHENTICATED", "Login required");
      expect(err.isTransient).toBe(false);
    });

    it("classifies AI_FAILED as non-transient", () => {
      const err = new CloudFunctionError("AI_FAILED", "AI broke");
      expect(err.isTransient).toBe(false);
    });

    it("classifies unknown codes as non-transient", () => {
      const err = new CloudFunctionError("SOMETHING_WEIRD", "Huh");
      expect(err.isTransient).toBe(false);
    });
  });

  describe("Error inheritance", () => {
    it("is an instance of Error", () => {
      const err = new CloudFunctionError("NOT_FOUND", "Gone");
      expect(err).toBeInstanceOf(Error);
    });

    it("has correct stack trace", () => {
      const err = new CloudFunctionError("INTERNAL", "Oops");
      expect(err.stack).toBeDefined();
    });
  });
});
