const { toUTCDayKey, toUTCMidnight, toISODate } = require("../lib/utils");

describe("lib/utils — canonical day-key functions", () => {
  describe("toUTCDayKey", () => {
    test("returns YYYY-MM-DD for a plain Date", () => {
      const d = new Date("2026-03-19T15:30:00Z");
      expect(toUTCDayKey(d)).toBe("2026-03-19");
    });

    test("returns UTC date even when local time crosses midnight", () => {
      // 11:30 PM UTC on March 19 = March 20 in UTC+3
      const d = new Date("2026-03-19T23:30:00Z");
      expect(toUTCDayKey(d)).toBe("2026-03-19");
    });

    test("handles Firestore-like Timestamp objects", () => {
      const fakeTimestamp = {
        toDate: () => new Date("2026-06-15T08:00:00Z"),
      };
      expect(toUTCDayKey(fakeTimestamp)).toBe("2026-06-15");
    });

    test("handles epoch milliseconds", () => {
      const epoch = new Date("2026-01-01T00:00:00Z").getTime();
      expect(toUTCDayKey(epoch)).toBe("2026-01-01");
    });

    test("falls back to current date for null/undefined", () => {
      const result = toUTCDayKey(null);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("is consistent with toISODate for the same Date", () => {
      const d = new Date("2026-07-04T12:00:00Z");
      expect(toUTCDayKey(d)).toBe(toISODate(d));
    });
  });

  describe("toUTCMidnight", () => {
    test("returns midnight UTC from a date string", () => {
      const result = toUTCMidnight("2026-03-19");
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    });

    test("returns midnight UTC from a Date with time", () => {
      const input = new Date("2026-03-19T18:45:30Z");
      const result = toUTCMidnight(input);
      expect(result.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    });

    test("round-trips with toUTCDayKey", () => {
      const dayKey = "2026-12-25";
      const midnight = toUTCMidnight(dayKey);
      expect(toUTCDayKey(midnight)).toBe(dayKey);
    });
  });
});
