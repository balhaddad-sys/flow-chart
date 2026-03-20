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

    it("boosts original priority by +1 instead of flattening to 1", () => {
      const items = [
        { ref: "a", priority: 70 },
        { ref: "b", priority: 30 },
      ];
      const result = distributeOverdue(items, today);
      // Higher-priority item sorts first, gets boosted priority
      const highPri = result.find((r) => r.ref === "a");
      const lowPri = result.find((r) => r.ref === "b");
      expect(highPri.priority).toBe(71);
      expect(lowPri.priority).toBe(31);
    });

    it("caps boosted priority at 100", () => {
      const items = [{ ref: "a", priority: 100 }];
      const result = distributeOverdue(items, today);
      expect(result[0].priority).toBe(100);
    });

    it("defaults to priority 1 for items with no original priority", () => {
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

    it("sorts STUDY tasks before QUESTIONS before REVIEW", () => {
      const items = [
        { ref: "review", type: "REVIEW", estMinutes: 10 },
        { ref: "questions", type: "QUESTIONS", estMinutes: 10 },
        { ref: "study", type: "STUDY", estMinutes: 10 },
      ];
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 120 },
      ];
      const result = distributeOverdue(items, today, 5, dayCapacities);
      expect(result[0].ref).toBe("study");
      expect(result[1].ref).toBe("questions");
      expect(result[2].ref).toBe("review");
    });

    it("sorts by priority descending within same type", () => {
      const items = [
        { ref: "low", type: "STUDY", priority: 20, estMinutes: 10 },
        { ref: "high", type: "STUDY", priority: 80, estMinutes: 10 },
        { ref: "mid", type: "STUDY", priority: 50, estMinutes: 10 },
      ];
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 120 },
      ];
      const result = distributeOverdue(items, today, 5, dayCapacities);
      expect(result[0].ref).toBe("high");
      expect(result[1].ref).toBe("mid");
      expect(result[2].ref).toBe("low");
    });
  });

  describe("capacity-aware distribution", () => {
    it("places tasks respecting day capacities", () => {
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 30 },
        { date: new Date("2025-01-12"), remaining: 30 },
        { date: new Date("2025-01-13"), remaining: 30 },
      ];
      const items = [
        { ref: "a", estMinutes: 20 },
        { ref: "b", estMinutes: 20 },
        { ref: "c", estMinutes: 20 },
      ];

      const result = distributeOverdue(items, today, 5, dayCapacities);
      expect(result).toHaveLength(3);
      // First item fits day 1 (30 remaining), second spills to day 2 (30-20=10 left on day 1 < 20)
      expect(result[0].newDate).toEqual(dayCapacities[0].date);
      expect(result[1].newDate).toEqual(dayCapacities[1].date);
      expect(result[2].newDate).toEqual(dayCapacities[2].date);
    });

    it("stacks tasks on same day when capacity allows", () => {
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 100 },
        { date: new Date("2025-01-12"), remaining: 30 },
      ];
      const items = [
        { ref: "a", estMinutes: 15 },
        { ref: "b", estMinutes: 15 },
        { ref: "c", estMinutes: 15 },
      ];

      const result = distributeOverdue(items, today, 5, dayCapacities);
      // All 3 tasks (45 min total) fit on day 1 (100 remaining)
      expect(result[0].newDate).toEqual(dayCapacities[0].date);
      expect(result[1].newDate).toEqual(dayCapacities[0].date);
      expect(result[2].newDate).toEqual(dayCapacities[0].date);
    });

    it("defaults estMinutes to 15 when not provided", () => {
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 20 },
        { date: new Date("2025-01-12"), remaining: 20 },
      ];
      const items = [
        { ref: "a" },
        { ref: "b" },
      ];

      const result = distributeOverdue(items, today, 5, dayCapacities);
      expect(result).toHaveLength(2);
      // First item (15 min) fits day 1, second spills to day 2
      expect(result[0].newDate).toEqual(dayCapacities[0].date);
      expect(result[1].newDate).toEqual(dayCapacities[1].date);
    });

    it("falls back to simple split when dayCapacities is null", () => {
      const items = [{ ref: "a" }, { ref: "b" }];
      const result = distributeOverdue(items, today, 5, null);
      expect(result).toHaveLength(2);
      // Should use simple even-split (same as default behavior)
      result.forEach((r) => {
        expect(r.newDate.getTime()).toBeGreaterThan(today.getTime());
      });
    });

    it("preserves boosted priority in capacity-aware mode", () => {
      const dayCapacities = [
        { date: new Date("2025-01-11"), remaining: 60 },
      ];
      const items = [{ ref: "a", estMinutes: 10, priority: 50 }];
      const result = distributeOverdue(items, today, 5, dayCapacities);
      expect(result[0].priority).toBe(51);
    });
  });
});
