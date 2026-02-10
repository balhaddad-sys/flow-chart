const { shuffleArray, clampInt, truncate, toISODate, weekdayName } = require("../lib/utils");

describe("lib/utils", () => {
  // ── shuffleArray ────────────────────────────────────────────────────────────

  describe("shuffleArray", () => {
    it("returns a new array (does not mutate original)", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(original).toEqual([1, 2, 3, 4, 5]);
      expect(shuffled).toHaveLength(5);
    });

    it("contains the same elements", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns empty array for empty input", () => {
      expect(shuffleArray([])).toEqual([]);
    });

    it("returns single-element array unchanged", () => {
      expect(shuffleArray([42])).toEqual([42]);
    });
  });

  // ── clampInt ────────────────────────────────────────────────────────────────

  describe("clampInt", () => {
    it("clamps to min", () => {
      expect(clampInt(-5, 0, 100)).toBe(0);
    });

    it("clamps to max", () => {
      expect(clampInt(200, 0, 100)).toBe(100);
    });

    it("floors fractional values", () => {
      expect(clampInt(7.9, 0, 100)).toBe(7);
    });

    it("passes through values within range", () => {
      expect(clampInt(50, 0, 100)).toBe(50);
    });

    it("handles equal min and max", () => {
      expect(clampInt(999, 5, 5)).toBe(5);
    });
  });

  // ── truncate ────────────────────────────────────────────────────────────────

  describe("truncate", () => {
    it("returns string unchanged when within limit", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates long strings", () => {
      expect(truncate("hello world", 5)).toBe("hello");
    });

    it("handles null/undefined by converting to empty string", () => {
      expect(truncate(null, 10)).toBe("");
      expect(truncate(undefined, 10)).toBe("");
    });

    it("coerces non-strings", () => {
      expect(truncate(12345, 3)).toBe("123");
    });
  });

  // ── toISODate ───────────────────────────────────────────────────────────────

  describe("toISODate", () => {
    it("returns YYYY-MM-DD format", () => {
      const date = new Date("2025-03-15T12:30:00Z");
      expect(toISODate(date)).toBe("2025-03-15");
    });
  });

  // ── weekdayName ─────────────────────────────────────────────────────────────

  describe("weekdayName", () => {
    it("returns lowercase English weekday", () => {
      // Jan 1 2025 is a Wednesday
      const date = new Date("2025-01-01T00:00:00Z");
      expect(weekdayName(date)).toBe("wednesday");
    });
  });
});
