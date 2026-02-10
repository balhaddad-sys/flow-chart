const { Errors, fail, ok, safeError } = require("../lib/errors");

describe("lib/errors", () => {
  // ── Errors catalogue ────────────────────────────────────────────────────────

  describe("Errors", () => {
    it("is frozen (immutable)", () => {
      expect(Object.isFrozen(Errors)).toBe(true);
    });

    it("has code and message on every entry", () => {
      Object.values(Errors).forEach((entry) => {
        expect(typeof entry.code).toBe("string");
        expect(typeof entry.message).toBe("string");
        expect(entry.code.length).toBeGreaterThan(0);
        expect(entry.message.length).toBeGreaterThan(0);
      });
    });

    it("includes all expected error codes", () => {
      const codes = Object.values(Errors).map((e) => e.code);
      expect(codes).toContain("UNAUTHENTICATED");
      expect(codes).toContain("NOT_FOUND");
      expect(codes).toContain("INVALID_ARGUMENT");
      expect(codes).toContain("INTERNAL");
      expect(codes).toContain("AI_FAILED");
      expect(codes).toContain("RATE_LIMITED");
    });
  });

  // ── fail() ──────────────────────────────────────────────────────────────────

  describe("fail", () => {
    it("returns standardised failure envelope", () => {
      const result = fail(Errors.NOT_FOUND);
      expect(result).toEqual({
        success: false,
        error: { code: "NOT_FOUND", message: Errors.NOT_FOUND.message },
      });
    });

    it("allows custom message override", () => {
      const result = fail(Errors.NOT_FOUND, "Course not found.");
      expect(result.error.message).toBe("Course not found.");
      expect(result.error.code).toBe("NOT_FOUND");
    });
  });

  // ── ok() ────────────────────────────────────────────────────────────────────

  describe("ok", () => {
    it("returns standardised success envelope", () => {
      const result = ok({ items: [1, 2, 3] });
      expect(result).toEqual({
        success: true,
        data: { items: [1, 2, 3] },
      });
    });

    it("wraps any data type", () => {
      expect(ok(null)).toEqual({ success: true, data: null });
      expect(ok("hello")).toEqual({ success: true, data: "hello" });
      expect(ok(42)).toEqual({ success: true, data: 42 });
    });
  });

  // ── safeError() ─────────────────────────────────────────────────────────────

  describe("safeError", () => {
    it("maps permission-denied to PERMISSION_DENIED", () => {
      const err = new Error("denied");
      err.code = "permission-denied";
      const result = safeError(err, "test op");
      expect(result.error.code).toBe("PERMISSION_DENIED");
    });

    it("maps not-found to NOT_FOUND", () => {
      const err = new Error("missing");
      err.code = "not-found";
      const result = safeError(err, "test op");
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("maps resource-exhausted to RATE_LIMITED", () => {
      const err = new Error("limit");
      err.code = "resource-exhausted";
      const result = safeError(err, "test op");
      expect(result.error.code).toBe("RATE_LIMITED");
    });

    it("falls back to INTERNAL for unknown error codes", () => {
      const err = new Error("something weird");
      err.code = "some-random-code";
      const result = safeError(err, "quiz retrieval");
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toContain("quiz retrieval");
    });

    it("always returns success: false", () => {
      const err = new Error("fail");
      const result = safeError(err, "op");
      expect(result.success).toBe(false);
    });
  });
});
