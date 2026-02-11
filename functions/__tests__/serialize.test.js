const {
  normaliseBlueprint,
  normaliseQuestion,
  normaliseTutorResponse,
} = require("../lib/serialize");

describe("lib/serialize", () => {
  // ── normaliseBlueprint ──────────────────────────────────────────────────────

  describe("normaliseBlueprint", () => {
    it("transforms snake_case AI response to camelCase Firestore schema", () => {
      const raw = {
        title: "Cardiac Physiology",
        difficulty: 4,
        estimated_minutes: 25,
        topic_tags: ["cardio", "physiology"],
        learning_objectives: ["Understand cardiac output"],
        key_concepts: ["Starling's law"],
        high_yield_points: ["EF normal range"],
        common_traps: ["Confusing preload vs afterload"],
        terms_to_define: ["Contractility"],
      };

      const result = normaliseBlueprint(raw);

      expect(result.title).toBe("Cardiac Physiology");
      expect(result.difficulty).toBe(4);
      expect(result.estMinutes).toBe(25);
      expect(result.topicTags).toEqual(["cardio", "physiology"]);
      expect(result.blueprint.learningObjectives).toEqual(["Understand cardiac output"]);
      expect(result.blueprint.keyConcepts).toEqual(["Starling's law"]);
      expect(result.blueprint.highYieldPoints).toEqual(["EF normal range"]);
      expect(result.blueprint.commonTraps).toEqual(["Confusing preload vs afterload"]);
      expect(result.blueprint.termsToDefine).toEqual(["Contractility"]);
    });

    it("provides defaults for missing fields", () => {
      const result = normaliseBlueprint({});

      expect(result.title).toBe("");
      expect(result.difficulty).toBe(3);
      expect(result.estMinutes).toBe(15);
      expect(result.topicTags).toEqual([]);
      expect(result.blueprint.learningObjectives).toEqual([]);
      expect(result.blueprint.keyConcepts).toEqual([]);
      expect(result.blueprint.highYieldPoints).toEqual([]);
      expect(result.blueprint.commonTraps).toEqual([]);
      expect(result.blueprint.termsToDefine).toEqual([]);
    });
  });

  // ── normaliseQuestion ───────────────────────────────────────────────────────

  describe("normaliseQuestion", () => {
    const defaults = {
      fileId: "f1",
      sectionId: "s1",
      sectionTitle: "Cardiac Anatomy",
      topicTags: ["cardio"],
    };

    const validRaw = {
      stem: "What is the main function of the left ventricle?",
      options: ["Pump blood to lungs", "Pump blood to body", "Filter blood", "Store blood"],
      correct_index: 1,
      difficulty: 4,
      tags: ["cardio", "anatomy"],
      explanation: {
        correct_why: "The LV pumps oxygenated blood systemically.",
        why_others_wrong: "Other options describe different structures.",
        key_takeaway: "LV = systemic pump.",
      },
      source_ref: { sectionLabel: "Heart Chambers" },
    };

    it("transforms a valid AI question to Firestore schema", () => {
      const result = normaliseQuestion(validRaw, defaults);

      expect(result).not.toBeNull();
      expect(result.stem).toBe(validRaw.stem);
      expect(result.options).toEqual(validRaw.options);
      expect(result.correctIndex).toBe(1);
      expect(result.difficulty).toBe(4);
      expect(result.topicTags).toEqual(["cardio", "anatomy"]);
      expect(result.type).toBe("SBA");
      expect(result.explanation.correctWhy).toBe("The LV pumps oxygenated blood systemically.");
      expect(result.explanation.whyOthersWrong).toBe("Other options describe different structures.");
      expect(result.explanation.keyTakeaway).toBe("LV = systemic pump.");
      expect(result.sourceRef.fileId).toBe("f1");
      expect(result.sourceRef.sectionId).toBe("s1");
      expect(result.sourceRef.label).toBe("Heart Chambers");
      expect(result.stats).toEqual({ timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 });
    });

    it("returns null for missing stem", () => {
      const raw = { ...validRaw, stem: undefined };
      expect(normaliseQuestion(raw, defaults)).toBeNull();
    });

    it("returns null for missing options", () => {
      const raw = { ...validRaw, options: "not an array" };
      expect(normaliseQuestion(raw, defaults)).toBeNull();
    });

    it("returns null for missing correct_index", () => {
      const raw = { ...validRaw, correct_index: undefined };
      expect(normaliseQuestion(raw, defaults)).toBeNull();
    });

    it("falls back to defaults.topicTags when raw.tags is not an array", () => {
      const raw = { ...validRaw, tags: "not-array" };
      const result = normaliseQuestion(raw, defaults);
      expect(result.topicTags).toEqual(["cardio"]);
    });

    it("clamps difficulty to [1, 5]", () => {
      // difficulty 0 is falsy → defaults to 3 via (raw.difficulty || 3)
      const low = normaliseQuestion({ ...validRaw, difficulty: 0 }, defaults);
      const high = normaliseQuestion({ ...validRaw, difficulty: 10 }, defaults);
      expect(low.difficulty).toBe(3);
      expect(high.difficulty).toBe(5);
    });

    it("clamps correctIndex to valid option range", () => {
      const raw = { ...validRaw, correct_index: 99 };
      const result = normaliseQuestion(raw, defaults);
      expect(result.correctIndex).toBe(3); // last valid index
    });

    it("truncates long stems", () => {
      const raw = { ...validRaw, stem: "x".repeat(3000) };
      const result = normaliseQuestion(raw, defaults);
      expect(result.stem.length).toBe(2000);
    });

    it("limits options to 8", () => {
      const raw = { ...validRaw, options: Array(12).fill("opt") };
      const result = normaliseQuestion(raw, defaults);
      expect(result.options).toHaveLength(8);
    });

    it("uses defaults.sectionTitle when source_ref.sectionLabel is missing", () => {
      const raw = { ...validRaw, source_ref: {} };
      const result = normaliseQuestion(raw, defaults);
      expect(result.sourceRef.label).toBe("Cardiac Anatomy");
    });
  });

  // ── normaliseTutorResponse ──────────────────────────────────────────────────

  describe("normaliseTutorResponse", () => {
    it("transforms a valid tutor response", () => {
      const raw = {
        correct_answer: "Option B",
        why_correct: "Because the LV is the systemic pump.",
        why_student_wrong: "You chose the pulmonary circuit instead.",
        key_takeaway: "LV = body, RV = lungs.",
        follow_ups: [
          { q: "What does the RV do?", a: "Pumps blood to lungs." },
        ],
      };

      const result = normaliseTutorResponse(raw);

      expect(result).not.toBeNull();
      expect(result.correctAnswer).toBe("Option B");
      expect(result.whyCorrect).toBe("Because the LV is the systemic pump.");
      expect(result.whyStudentWrong).toBe("You chose the pulmonary circuit instead.");
      expect(result.keyTakeaway).toBe("LV = body, RV = lungs.");
      expect(result.followUps).toHaveLength(1);
      expect(result.followUps[0]).toEqual({ q: "What does the RV do?", a: "Pumps blood to lungs." });
    });

    it("handles nested tutor wrapper", () => {
      const raw = {
        tutor: {
          correct_answer: "A",
          why_correct: "Reason",
        },
      };

      const result = normaliseTutorResponse(raw);
      expect(result.correctAnswer).toBe("A");
      expect(result.whyCorrect).toBe("Reason");
    });

    it("returns null for malformed response (missing both fields)", () => {
      expect(normaliseTutorResponse({})).toBeNull();
      expect(normaliseTutorResponse({ tutor: {} })).toBeNull();
    });

    it("returns null when only correct_answer is present (missing why_correct)", () => {
      expect(normaliseTutorResponse({ correct_answer: "A" })).toBeNull();
    });

    it("returns null when only why_correct is present (missing correct_answer)", () => {
      expect(normaliseTutorResponse({ why_correct: "Because..." })).toBeNull();
    });

    it("defaults missing string fields to empty string", () => {
      const raw = { correct_answer: "A", why_correct: "Because A is right" };
      const result = normaliseTutorResponse(raw);
      expect(result.correctAnswer).toBe("A");
      expect(result.whyCorrect).toBe("Because A is right");
      expect(result.whyStudentWrong).toBe("");
      expect(result.keyTakeaway).toBe("");
    });

    it("defaults follow_ups to empty array when not an array", () => {
      const raw = { correct_answer: "A", why_correct: "Because A", follow_ups: "not-an-array" };
      const result = normaliseTutorResponse(raw);
      expect(result.followUps).toEqual([]);
    });
  });
});
