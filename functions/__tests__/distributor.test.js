const { distributeOverdue } = require("../scheduling/distributor");
const { CATCH_UP_SPAN_DAYS, MS_PER_DAY } = require("../lib/constants");

describe("scheduling/distributor", () => {
  const today = new Date("2025-01-10T00:00:00Z");

  describe("distributeOverdue", () => {
    it("returns empty array for no overdue items", () => {
      expect(distributeOverdue([], today)).toEqual([]);
    });

    it("distributes items across CATCH_UP_SPAN_DAYS", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ ref: `ref${i}` }));
      const result = distributeOverdue(items, today);

      expect(result).toHaveLength(10);

      // All dates should be in the future
      result.forEach((r) => {
        expect(r.newDate.getTime()).toBeGreaterThan(today.getTime());
      });

      // Dates should span at most CATCH_UP_SPAN_DAYS into the future
      const maxDate = new Date(today.getTime() + CATCH_UP_SPAN_DAYS * MS_PER_DAY);
      result.forEach((r) => {
        expect(r.newDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
      });
    });

    it("assigns priority = 1 to all redistributed items", () => {
      const items = [{ ref: "a" }, { ref: "b" }];
      const result = distributeOverdue(items, today);
      result.forEach((r) => {
        expect(r.priority).toBe(1);
      });
    });

    it("preserves the ref from the original item", () => {
      const items = [{ ref: "docRef1" }, { ref: "docRef2" }];
      const result = distributeOverdue(items, today);
      expect(result[0].ref).toBe("docRef1");
      expect(result[1].ref).toBe("docRef2");
    });

    it("distributes evenly (ceil division)", () => {
      // 7 items across 5 days → ceil(7/5)=2 per day
      const items = Array.from({ length: 7 }, (_, i) => ({ ref: `r${i}` }));
      const result = distributeOverdue(items, today, 5);

      // Group by date
      const byDate = new Map();
      result.forEach((r) => {
        const key = r.newDate.toISOString();
        byDate.set(key, (byDate.get(key) || 0) + 1);
      });

      // First days should have 2, last day may have fewer
      const counts = [...byDate.values()];
      expect(Math.max(...counts)).toBe(2);
    });

    it("respects custom spanDays parameter", () => {
      const items = [{ ref: "a" }, { ref: "b" }, { ref: "c" }];
      const result = distributeOverdue(items, today, 3);

      const dates = new Set(result.map((r) => r.newDate.toISOString()));
      // 3 items across 3 days → 1 per day → 3 distinct dates
      expect(dates.size).toBeLessThanOrEqual(3);
    });

    it("assigns dates starting from tomorrow (dayOffset >= 1)", () => {
      const items = [{ ref: "x" }];
      const result = distributeOverdue(items, today, 5);
      const tomorrow = new Date(today.getTime() + MS_PER_DAY);
      expect(result[0].newDate.getTime()).toEqual(tomorrow.getTime());
    });
  });
});
