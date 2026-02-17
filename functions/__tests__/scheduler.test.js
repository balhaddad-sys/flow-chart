const {
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
} = require("../scheduling/scheduler");

describe("scheduling/scheduler", () => {
  // ── buildWorkUnits ──────────────────────────────────────────────────────────

  describe("buildWorkUnits", () => {
    const sections = [
      { id: "s1", title: "Cardiac Anatomy", estMinutes: 30, difficulty: 4, topicTags: ["cardio"], questionsStatus: "COMPLETED" },
      { id: "s2", title: "Renal Physiology", estMinutes: 20, difficulty: 2, questionsStatus: "COMPLETED" },
    ];

    it("creates STUDY + QUESTIONS tasks for each section", () => {
      const tasks = buildWorkUnits(sections, "course1", "off");
      const studyTasks = tasks.filter((t) => t.type === "STUDY");
      const questionTasks = tasks.filter((t) => t.type === "QUESTIONS");

      expect(studyTasks).toHaveLength(2);
      expect(questionTasks).toHaveLength(2);
    });

    it("only creates QUESTIONS tasks when questionsStatus is COMPLETED", () => {
      const sectionsWithMixedStatus = [
        { id: "s1", title: "Section 1", questionsStatus: "COMPLETED" },
        { id: "s2", title: "Section 2", questionsStatus: "PENDING" },
        { id: "s3", title: "Section 3", questionsStatus: "FAILED" },
        { id: "s4", title: "Section 4" }, // missing questionsStatus
      ];
      const tasks = buildWorkUnits(sectionsWithMixedStatus, "c1", "off");
      const questionTasks = tasks.filter((t) => t.type === "QUESTIONS");

      // Only s1 should have QUESTIONS task
      expect(questionTasks).toHaveLength(1);
      expect(questionTasks[0].sectionIds[0]).toBe("s1");
    });

    it("creates REVIEW tasks according to revision policy", () => {
      const off = buildWorkUnits(sections, "c1", "off").filter((t) => t.type === "REVIEW");
      const light = buildWorkUnits(sections, "c1", "light").filter((t) => t.type === "REVIEW");
      const standard = buildWorkUnits(sections, "c1", "standard").filter((t) => t.type === "REVIEW");
      const aggressive = buildWorkUnits(sections, "c1", "aggressive").filter((t) => t.type === "REVIEW");

      expect(off).toHaveLength(0);
      expect(light).toHaveLength(2);       // 1 review × 2 sections
      expect(standard).toHaveLength(6);    // 3 reviews × 2 sections
      expect(aggressive).toHaveLength(8);  // 4 reviews × 2 sections
    });

    it("falls back to 'standard' for unknown revision policy", () => {
      const tasks = buildWorkUnits(sections, "c1", "bogus");
      const reviews = tasks.filter((t) => t.type === "REVIEW");
      expect(reviews).toHaveLength(6); // standard = 3 reviews × 2 sections
    });

    it("clamps estMinutes to [5, 240]", () => {
      const tiny = [{ id: "s1", title: "T", estMinutes: 1 }];
      const huge = [{ id: "s1", title: "T", estMinutes: 999 }];

      const tinyTasks = buildWorkUnits(tiny, "c1", "off");
      const hugeTasks = buildWorkUnits(huge, "c1", "off");

      expect(tinyTasks.find((t) => t.type === "STUDY").estMinutes).toBe(5);
      expect(hugeTasks.find((t) => t.type === "STUDY").estMinutes).toBe(240);
    });

    it("clamps difficulty to [1, 5]", () => {
      const low = [{ id: "s1", title: "T", difficulty: -2 }];
      const high = [{ id: "s1", title: "T", difficulty: 10 }];

      expect(buildWorkUnits(low, "c1", "off")[0].difficulty).toBe(1);
      expect(buildWorkUnits(high, "c1", "off")[0].difficulty).toBe(5);
    });

    it("sets QUESTIONS estMinutes to 35% of study time (min 8)", () => {
      const tasks = buildWorkUnits(sections, "c1", "off");
      const q1 = tasks.find((t) => t.type === "QUESTIONS" && t.sectionIds[0] === "s1");
      expect(q1.estMinutes).toBe(Math.max(8, Math.round(30 * 0.35))); // 11
    });

    it("assigns courseId and topicTags to all tasks", () => {
      const tasks = buildWorkUnits(sections, "myCourse", "off");
      expect(tasks.every((t) => t.courseId === "myCourse")).toBe(true);
      expect(tasks.filter((t) => t.sectionIds[0] === "s1").every((t) => t.topicTags[0] === "cardio")).toBe(true);
    });

    it("defaults missing fields", () => {
      const bare = [{ id: "s1", title: "T" }];
      const tasks = buildWorkUnits(bare, "c1", "off");
      const study = tasks.find((t) => t.type === "STUDY");
      expect(study.estMinutes).toBe(15);
      expect(study.difficulty).toBe(3);
      expect(study.topicTags).toEqual([]);
    });

    it("derives a meaningful task title when section title is generic", () => {
      const generic = [
        {
          id: "s1",
          title: "Pages 1-10",
          topicTags: ["Acute Coronary Syndrome"],
          blueprint: {
            keyConcepts: ["ST-elevation myocardial infarction"],
            learningObjectives: ["Differentiate STEMI from NSTEMI"],
            highYieldPoints: [],
            termsToDefine: ["Troponin"],
          },
          questionsStatus: "COMPLETED",
        },
      ];

      const tasks = buildWorkUnits(generic, "c1", "off");
      const study = tasks.find((t) => t.type === "STUDY");
      expect(study.title).toMatch(/^Study:\s+/);
      expect(study.title).toContain("Acute Coronary Syndrome");
      expect(study.title).not.toContain("Pages 1-10");
    });
  });

  // ── computeTotalLoad ────────────────────────────────────────────────────────

  describe("computeTotalLoad", () => {
    it("sums estMinutes across all tasks", () => {
      const tasks = [{ estMinutes: 10 }, { estMinutes: 20 }, { estMinutes: 30 }];
      expect(computeTotalLoad(tasks)).toBe(60);
    });

    it("returns 0 for empty array", () => {
      expect(computeTotalLoad([])).toBe(0);
    });
  });

  // ── buildDayCapacities ──────────────────────────────────────────────────────

  describe("buildDayCapacities", () => {
    const today = new Date("2025-01-01T00:00:00Z");

    it("creates days from today to examDate", () => {
      const examDate = new Date("2025-01-05T00:00:00Z");
      const days = buildDayCapacities(today, examDate);
      expect(days.length).toBe(5); // Jan 1–5 inclusive
    });

    it("uses default 30-day period when no examDate", () => {
      const days = buildDayCapacities(today, null);
      expect(days.length).toBe(31); // day 0 through day 30
    });

    it("applies catch-up buffer (default 15%)", () => {
      const days = buildDayCapacities(today, new Date("2025-01-02T00:00:00Z"));
      // Default 120 min * 0.85 = 102
      expect(days[0].usableCapacity).toBe(102);
    });

    it("respects excludedDates", () => {
      const examDate = new Date("2025-01-05T00:00:00Z");
      const days = buildDayCapacities(today, examDate, {
        excludedDates: ["2025-01-03"],
      });
      const isos = days.map((d) => d.date.toISOString().split("T")[0]);
      expect(isos).not.toContain("2025-01-03");
      expect(days.length).toBe(4);
    });

    it("applies perDayOverrides", () => {
      const examDate = new Date("2025-01-02T00:00:00Z");
      // Jan 1 2025 is a Wednesday
      const days = buildDayCapacities(today, examDate, {
        perDayOverrides: { wednesday: 60 },
        catchUpBufferPercent: 0,
      });
      // Override is 60, buffer is 0%, so floor(60 * 1.0) = 60
      // But the default 15% is only skipped when catchUpBufferPercent is explicitly 0
      // clampInt(0, 0, 50) = 0, so buffer = 0 → usable = 60
      expect(days[0].usableCapacity).toBe(60);
    });

    it("clamps daily minutes to [30, 480]", () => {
      const days = buildDayCapacities(today, new Date("2025-01-02T00:00:00Z"), {
        defaultMinutesPerDay: 9999,
        catchUpBufferPercent: 0,
      });
      // 480 clamped, 0% buffer → floor(480 * 1.0) = 480
      expect(days[0].usableCapacity).toBe(480);
    });

    it("caps schedule at MAX_SCHEDULE_DAYS (365)", () => {
      const farDate = new Date("2027-01-01T00:00:00Z");
      const days = buildDayCapacities(today, farDate);
      expect(days.length).toBeLessThanOrEqual(365);
    });
  });

  // ── checkFeasibility ────────────────────────────────────────────────────────

  describe("checkFeasibility", () => {
    it("returns feasible when load fits", () => {
      const days = [{ usableCapacity: 60 }, { usableCapacity: 60 }];
      const result = checkFeasibility(100, days);
      expect(result.feasible).toBe(true);
      expect(result.deficit).toBe(0);
    });

    it("returns infeasible with correct deficit", () => {
      const days = [{ usableCapacity: 30 }, { usableCapacity: 30 }];
      const result = checkFeasibility(100, days);
      expect(result.feasible).toBe(false);
      expect(result.deficit).toBe(40);
    });

    it("handles empty days", () => {
      const result = checkFeasibility(10, []);
      expect(result.feasible).toBe(false);
      expect(result.deficit).toBe(10);
    });
  });

  // ── placeTasks ──────────────────────────────────────────────────────────────

  describe("placeTasks", () => {
    it("places study tasks onto day slots", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 30, difficulty: 3 },
        { type: "QUESTIONS", sectionIds: ["s1"], estMinutes: 10, difficulty: 3 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      expect(placed).toHaveLength(2);
      expect(placed[0].dueDate).toEqual(days[0].date);
    });

    it("keeps study tasks in section order for a holistic flow", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 10, difficulty: 1, sourceOrder: 0 },
        { type: "STUDY", sectionIds: ["s2"], estMinutes: 10, difficulty: 5, sourceOrder: 1 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      expect(placed[0].sectionIds[0]).toBe("s1");
      expect(placed[1].sectionIds[0]).toBe("s2");
    });

    it("spills to next day when capacity exhausted", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 50, difficulty: 3 },
        { type: "STUDY", sectionIds: ["s2"], estMinutes: 50, difficulty: 3 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
        { date: new Date("2025-01-02"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      expect(placed).toHaveLength(2);
      expect(placed[0].dueDate.toISOString()).toContain("2025-01-01");
      expect(placed[1].dueDate.toISOString()).toContain("2025-01-02");
    });

    it("places review tasks offset from their study task day", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 10, difficulty: 3 },
        { type: "REVIEW", sectionIds: ["s1"], estMinutes: 10, difficulty: 3, _dayOffset: 2 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
        { date: new Date("2025-01-02"), usableCapacity: 60, remaining: 60 },
        { date: new Date("2025-01-03"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      const review = placed.find((t) => t.type === "REVIEW");
      expect(review.dueDate.toISOString()).toContain("2025-01-03"); // day 0 + offset 2
    });

    it("clamps review day to last available day", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 10, difficulty: 3 },
        { type: "REVIEW", sectionIds: ["s1"], estMinutes: 10, difficulty: 3, _dayOffset: 99 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
        { date: new Date("2025-01-02"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      const review = placed.find((t) => t.type === "REVIEW");
      expect(review.dueDate.toISOString()).toContain("2025-01-02"); // clamped to last day
    });

    it("strips _dayOffset from placed review tasks", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 10, difficulty: 3 },
        { type: "REVIEW", sectionIds: ["s1"], estMinutes: 10, difficulty: 3, _dayOffset: 1 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 60, remaining: 60 },
        { date: new Date("2025-01-02"), usableCapacity: 60, remaining: 60 },
      ];

      const placed = placeTasks(tasks, days);
      const review = placed.find((t) => t.type === "REVIEW");
      expect(review._dayOffset).toBeUndefined();
    });

    it("splits oversized tasks instead of overfilling a day", () => {
      const tasks = [
        { type: "STUDY", sectionIds: ["s1"], estMinutes: 100, difficulty: 3 },
      ];
      const days = [
        { date: new Date("2025-01-01"), usableCapacity: 30, remaining: 30 },
      ];

      const placed = placeTasks(tasks, days);
      expect(placed).toHaveLength(1);
      expect(placed[0].estMinutes).toBe(30);
      expect(placed[0].dueDate).toEqual(new Date("2025-01-01"));
    });
  });
});
