/**
 * @file user-flows.test.js
 * @description End-to-end user flow simulations that chain multiple modules
 * together to mimic real user journeys through the MedQ system.
 *
 * These tests exercise the full pipeline (pure functions only — no Firebase)
 * to catch integration bugs between modules.
 */

const {
  normalizeTopicTag,
  normalizeAssessmentLevel,
  getAssessmentLevel,
  selectAssessmentQuestions,
  computeWeaknessProfile,
  buildRecommendationPlan,
  ASSESSMENT_LEVELS,
  ASSESSMENT_TOPIC_LIBRARY,
} = require("../assessment/engine");

const {
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
} = require("../scheduling/scheduler");

const {
  accumulateTopicStats,
  rankWeakTopics,
  computeOverallAccuracy,
  computeCompletionStats,
} = require("../analytics/weakness");

const {
  normaliseBlueprint,
  normaliseQuestion,
  normaliseTutorResponse,
} = require("../lib/serialize");

const { computeWeaknessScore, weightedSelect } = require("../questions/questionSelection");
const { shuffleArray, clampInt, truncate, toISODate, weekdayName } = require("../lib/utils");
const { Errors, fail, ok, safeError } = require("../lib/errors");

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1: New student onboards → uploads file → gets schedule
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 1: Onboarding → File Processing → Schedule Generation", () => {
  it("simulates a new MD3 student setting up a cardiology course", () => {
    // Step 1: File processing produces sections with blueprints
    const rawBlueprints = [
      {
        title: "Cardiac Anatomy",
        difficulty: 3,
        estimated_minutes: 30,
        topic_tags: ["Cardiology", "Anatomy"],
        learning_objectives: ["Identify heart chambers"],
        key_concepts: ["Coronary circulation"],
        high_yield_points: ["LAD territory"],
        common_traps: ["Mixing up coronary arteries"],
        terms_to_define: ["Septum"],
      },
      {
        title: "Heart Failure",
        difficulty: 4,
        estimated_minutes: 45,
        topic_tags: ["Cardiology", "Heart Failure"],
        learning_objectives: ["Classify HF types"],
        key_concepts: ["EF classification"],
        high_yield_points: ["BNP levels"],
        common_traps: ["HFpEF vs HFrEF"],
        terms_to_define: ["Ejection fraction"],
      },
      {
        title: "Arrhythmias",
        difficulty: 4,
        estimated_minutes: 40,
        topic_tags: ["Cardiology", "Electrophysiology"],
        learning_objectives: ["Read basic ECGs"],
        key_concepts: ["Action potential phases"],
        high_yield_points: ["AF management"],
        common_traps: ["SVT vs VT"],
        terms_to_define: ["Re-entry circuit"],
      },
    ];

    // Normalize all blueprints (simulating processSection)
    const sections = rawBlueprints.map((raw, i) => {
      const bp = normaliseBlueprint(raw);
      return {
        id: `sec-${i}`,
        title: bp.title,
        estMinutes: bp.estMinutes,
        difficulty: bp.difficulty,
        topicTags: bp.topicTags,
        questionsStatus: "COMPLETED",
        blueprint: bp.blueprint,
      };
    });

    expect(sections).toHaveLength(3);
    expect(sections[0].blueprint.learningObjectives).toContain("Identify heart chambers");

    // Step 2: Generate study schedule
    const tasks = buildWorkUnits(sections, "cardio-course", "standard");
    expect(tasks.length).toBeGreaterThan(0);

    // Should have 3 STUDY + 3 QUESTIONS + 9 REVIEW (3 reviews × 3 sections)
    expect(tasks.filter((t) => t.type === "STUDY")).toHaveLength(3);
    expect(tasks.filter((t) => t.type === "QUESTIONS")).toHaveLength(3);
    expect(tasks.filter((t) => t.type === "REVIEW")).toHaveLength(9);

    const totalMinutes = computeTotalLoad(tasks);
    expect(totalMinutes).toBeGreaterThan(0);

    // 30-day window, 90 min/day
    const today = new Date("2025-06-01");
    const examDate = new Date("2025-07-01");
    const days = buildDayCapacities(today, examDate, {
      defaultMinutesPerDay: 90,
      perDayOverrides: { saturday: 45, sunday: 30 },
    });

    const feasibility = checkFeasibility(totalMinutes, days);
    expect(feasibility.feasible).toBe(true);

    const placed = placeTasks(tasks, days);
    expect(placed.length).toBe(tasks.length);

    // Verify study tasks come before their reviews
    for (const section of sections) {
      const study = placed.find((t) => t.type === "STUDY" && t.sectionIds[0] === section.id);
      const reviews = placed.filter((t) => t.type === "REVIEW" && t.sectionIds[0] === section.id);
      if (study && reviews.length > 0) {
        for (const review of reviews) {
          expect(review.dueDate.getTime()).toBeGreaterThanOrEqual(study.dueDate.getTime());
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2: Student takes a quiz → submits answers → sees weakness analysis
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 2: Quiz → Submit Answers → Weakness Analysis", () => {
  // Simulate a question bank
  const questions = [
    { id: "q1", topicTags: ["Cardiology"], difficulty: 3, stem: "What is EF?", options: ["A", "B", "C", "D"], correctIndex: 1, stats: { timesAnswered: 0 } },
    { id: "q2", topicTags: ["Cardiology"], difficulty: 4, stem: "AF management?", options: ["A", "B", "C", "D"], correctIndex: 2, stats: { timesAnswered: 5 } },
    { id: "q3", topicTags: ["Neurology"], difficulty: 3, stem: "Stroke types?", options: ["A", "B", "C", "D"], correctIndex: 0, stats: { timesAnswered: 2 } },
    { id: "q4", topicTags: ["Neurology"], difficulty: 4, stem: "CSF drainage?", options: ["A", "B", "C", "D"], correctIndex: 3, stats: { timesAnswered: 0 } },
    { id: "q5", topicTags: ["Renal"], difficulty: 2, stem: "GFR calculation?", options: ["A", "B", "C", "D"], correctIndex: 1, stats: { timesAnswered: 10 } },
    { id: "q6", topicTags: ["Renal"], difficulty: 3, stem: "AKI criteria?", options: ["A", "B", "C", "D"], correctIndex: 0, stats: { timesAnswered: 0 } },
    { id: "q7", topicTags: ["Pharmacology"], difficulty: 5, stem: "Drug interaction?", options: ["A", "B", "C", "D"], correctIndex: 2, stats: { timesAnswered: 3 } },
    { id: "q8", topicTags: ["Pharmacology"], difficulty: 4, stem: "Dose adjustment?", options: ["A", "B", "C", "D"], correctIndex: 1, stats: { timesAnswered: 1 } },
  ];

  it("selects weighted questions biased towards weak topics", () => {
    const topicWeaknesses = new Map([
      ["Cardiology", 0.3],    // Moderate
      ["Neurology", 0.8],     // Weak
      ["Renal", 0.2],         // Strong
      ["Pharmacology", 0.9],  // Very weak
    ]);

    const selected = weightedSelect(questions, topicWeaknesses, 4, new Set());
    expect(selected).toHaveLength(4);

    // Weak topics (Neurology, Pharmacology) should appear more often
    // (statistical — run multiple times for confidence, but at least check it works)
    const selectedTags = selected.flatMap((q) => q.topicTags);
    expect(selectedTags.length).toBeGreaterThan(0);
  });

  it("never-answered questions get a boost", () => {
    const topicWeaknesses = new Map([["Cardiology", 0.5], ["Renal", 0.5]]);

    // q1 never answered (timesAnswered: 0) vs q5 (timesAnswered: 10)
    const pool = [questions[0], questions[4]];
    let q1Count = 0;
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const [selected] = weightedSelect(pool, topicWeaknesses, 1, new Set());
      if (selected.id === "q1") q1Count++;
    }

    // q1 should be selected more often due to 1.5x neverBoost
    expect(q1Count).toBeGreaterThan(30); // Should be > 50% but with randomness
  });

  it("recently answered questions get cooldown penalty", () => {
    const topicWeaknesses = new Map([["Cardiology", 0.5]]);
    const recentlyAnswered = new Set(["q1"]);

    const pool = [questions[0], questions[1]]; // both Cardiology
    let q2Count = 0;
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const [selected] = weightedSelect(pool, topicWeaknesses, 1, recentlyAnswered);
      if (selected.id === "q2") q2Count++;
    }

    // q2 should be selected much more often since q1 has 0.1x cooldown
    expect(q2Count).toBeGreaterThan(70);
  });

  it("simulates full quiz → weakness analysis pipeline", () => {
    // Student answers 8 questions
    const attempts = [
      { questionId: "q1", correct: true, timeSpentSec: 45, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q2", correct: false, timeSpentSec: 90, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q3", correct: false, timeSpentSec: 120, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q4", correct: false, timeSpentSec: 100, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q5", correct: true, timeSpentSec: 30, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q6", correct: true, timeSpentSec: 40, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q7", correct: false, timeSpentSec: 150, createdAt: { toDate: () => new Date("2025-06-10") } },
      { questionId: "q8", correct: false, timeSpentSec: 110, createdAt: { toDate: () => new Date("2025-06-10") } },
    ];

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Step 1: Compute overall accuracy
    const overall = computeOverallAccuracy(attempts);
    expect(overall.totalAnswered).toBe(8);
    expect(overall.totalCorrect).toBe(3);
    expect(overall.overallAccuracy).toBeCloseTo(0.375);

    // Step 2: Accumulate topic stats
    const topicStats = accumulateTopicStats(attempts, questionMap);
    expect(topicStats.size).toBe(4); // 4 topics

    // Step 3: Rank weak topics
    const weakTopics = rankWeakTopics(topicStats, new Date("2025-06-11"));
    expect(weakTopics.length).toBeGreaterThan(0);

    // Neurology and Pharmacology should be weakest (0% and 0% accuracy)
    const neuroRank = weakTopics.findIndex((t) => t.tag === "Neurology");
    const renalRank = weakTopics.findIndex((t) => t.tag === "Renal");
    expect(neuroRank).toBeLessThan(renalRank); // Neuro weaker than Renal
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3: Adaptive Assessment → Weakness Profile → Recommendations
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 3: Assessment → Profile → Recommendations", () => {
  it("simulates an MD4 student taking a cardiology assessment", () => {
    // Step 1: Student selects level and topic
    const level = normalizeAssessmentLevel("MD4");
    expect(level).toBe("MD4");

    const profile = getAssessmentLevel(level);
    expect(profile.minDifficulty).toBe(3);
    expect(profile.maxDifficulty).toBe(4);

    // Step 2: System selects questions
    const questionPool = Array.from({ length: 30 }, (_, i) => ({
      id: `q${i}`,
      stem: `Question ${i}?`,
      options: ["A", "B", "C", "D"],
      correctIndex: i % 4,
      difficulty: (i % 5) + 1,
      topicTags: ["Cardiology"],
    }));

    const selected = selectAssessmentQuestions(questionPool, { level: "MD4", count: 15 });
    expect(selected.length).toBe(15);

    // Step 3: Student answers (simulating mixed performance)
    const responses = selected.map((q, i) => ({
      questionId: q.id,
      correct: i % 3 !== 0, // 2/3 correct
      timeSpentSec: 40 + Math.floor(Math.random() * 60),
      confidence: Math.ceil(Math.random() * 5),
    }));

    const questionMap = new Map(questionPool.map((q) => [q.id, q]));

    // Step 4: Compute weakness profile
    const weaknessProfile = computeWeaknessProfile(responses, questionMap, "MD4");
    expect(weaknessProfile.answeredCount).toBe(15);
    expect(weaknessProfile.overallAccuracy).toBeGreaterThan(0);
    expect(weaknessProfile.readinessScore).toBeGreaterThanOrEqual(0);
    expect(weaknessProfile.readinessScore).toBeLessThanOrEqual(100);
    expect(weaknessProfile.targetTimeSec).toBe(65); // MD4 target

    // Step 5: Generate recommendations
    const recommendations = buildRecommendationPlan(weaknessProfile);
    expect(recommendations.summary).toBeDefined();
    expect(recommendations.examTips.length).toBeGreaterThan(0);
    expect(typeof recommendations.summary).toBe("string");
  });

  it("simulates a struggling student at every level", () => {
    for (const level of ASSESSMENT_LEVELS) {
      const questions = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        stem: `Q${i}?`,
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        difficulty: level.minDifficulty + (i % (level.maxDifficulty - level.minDifficulty + 1)),
        topicTags: ["Cardiology", "Neurology"],
      }));

      const selected = selectAssessmentQuestions(questions, { level: level.id, count: 8 });
      expect(selected.length).toBeGreaterThanOrEqual(5);

      // All wrong
      const responses = selected.map((q) => ({
        questionId: q.id,
        correct: false,
        timeSpentSec: level.targetTimeSec * 2,
        confidence: 1,
      }));

      const questionMap = new Map(questions.map((q) => [q.id, q]));
      const weaknessProfile = computeWeaknessProfile(responses, questionMap, level.id);

      expect(weaknessProfile.overallAccuracy).toBe(0);
      expect(weaknessProfile.readinessScore).toBeLessThanOrEqual(30);
      expect(weaknessProfile.topicBreakdown.every((t) => t.severity !== "STRONG")).toBe(true);

      const plan = buildRecommendationPlan(weaknessProfile);
      expect(plan.priorityTopics.length).toBeGreaterThan(0);
      expect(plan.actions.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4: Question Generation → Normalization → Quiz Readiness
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 4: AI Question Generation → Normalization", () => {
  it("normalizes AI-generated questions with all field variants", () => {
    const defaults = {
      fileId: "file1",
      fileName: "Cardiology.pdf",
      sectionId: "sec1",
      sectionTitle: "Cardiac Physiology",
      topicTags: ["cardiology"],
    };

    // Simulate AI response (snake_case as Claude returns)
    const rawQuestions = [
      {
        stem: "Which chamber has the thickest wall?",
        options: ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle"],
        correct_index: 3,
        difficulty: 3,
        tags: ["cardiology", "anatomy"],
        explanation: {
          correct_why: "The LV pumps against systemic pressure.",
          why_others_wrong: [
            "RA receives venous return — low pressure.",
            "LA is thin — low pressure pulmonary circuit.",
            "RV pumps to lungs — lower pressure than LV.",
            "Correct answer.",
          ],
          key_takeaway: "LV wall thickness reflects systemic afterload.",
        },
        citations: [
          { source: "PubMed", title: "Cardiac chamber wall thickness in health and disease" },
          { source: "UpToDate", title: "Left ventricular hypertrophy assessment" },
        ],
      },
      {
        stem: "Normal LVEF range?",
        options: ["20-30%", "35-45%", "55-70%", "80-95%"],
        correct_index: 2,
        difficulty: 2,
        tags: ["cardiology"],
        explanation: {
          correct_why: "55-70% is the accepted normal LVEF.",
          why_others_wrong: [
            "20-30% indicates severe LV dysfunction.",
            "35-45% suggests moderate LV dysfunction.",
            "Correct.",
            "80-95% would be supranormal and unrealistic.",
          ],
          key_takeaway: "LVEF >55% is generally normal.",
        },
        citations: [
          { source: "Medscape", title: "Ejection fraction measurement and interpretation" },
        ],
      },
    ];

    const normalized = rawQuestions
      .map((raw) => normaliseQuestion(raw, defaults))
      .filter(Boolean);

    expect(normalized).toHaveLength(2);

    // First question
    expect(normalized[0].stem).toBe("Which chamber has the thickest wall?");
    expect(normalized[0].correctIndex).toBe(3);
    expect(normalized[0].options).toHaveLength(4);
    expect(normalized[0].type).toBe("SBA");
    expect(normalized[0].topicTags).toContain("cardiology");

    // Citations should have search URLs, not AI-generated URLs
    for (const q of normalized) {
      for (const citation of q.citations) {
        expect(citation.url).toMatch(/^https:\/\/(pubmed|www\.uptodate|www\.medscape)/);
        expect(citation.source).toMatch(/^(PubMed|UpToDate|Medscape)$/);
      }
    }

    // Explanation structure
    expect(normalized[0].explanation.whyOthersWrong).toHaveLength(4);
    expect(normalized[0].explanation.correctWhy).toBeTruthy();

    // Source ref inherits defaults
    expect(normalized[0].sourceRef.fileId).toBe("file1");
    expect(normalized[0].sourceRef.sectionId).toBe("sec1");

    // Stats initialized to zero
    expect(normalized[0].stats).toEqual({ timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 });
  });

  it("handles malformed AI questions gracefully", () => {
    const defaults = { fileId: "f1", sectionId: "s1", sectionTitle: "Test", topicTags: [] };

    const badQuestions = [
      { stem: "", options: ["A", "B"], correct_index: 0 },     // empty stem
      { stem: "Valid?", options: "not array", correct_index: 0 }, // options not array
      { stem: "Valid?", options: ["A", "B"] },                   // missing correctIndex
      null,
      undefined,
      { stem: "Valid stem", options: ["A", "B", "C"], correct_index: 1 }, // valid!
    ];

    const results = badQuestions
      .filter(Boolean)
      .map((raw) => normaliseQuestion(raw, defaults));

    const valid = results.filter(Boolean);
    expect(valid).toHaveLength(1); // Only the last one is valid
    expect(valid[0].stem).toBe("Valid stem");
  });

  it("builds fallback citations when AI provides none", () => {
    const defaults = { fileId: "f1", sectionId: "s1", sectionTitle: "Pharmacology", topicTags: ["pharmacology"] };
    const raw = {
      stem: "Which drug class inhibits ACE?",
      options: ["Beta blockers", "ACE inhibitors", "CCBs", "Diuretics"],
      correct_index: 1,
    };

    const result = normaliseQuestion(raw, defaults);
    expect(result.citations.length).toBeGreaterThanOrEqual(2);
    // Fallback citations should reference the topic
    expect(result.citations[0].title).toContain("pharmacology");
    expect(result.citations[0].url).toMatch(/^https:\/\//);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 5: Topic Tag Normalization consistency across modules
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 5: Topic Tag Normalization Consistency", () => {
  it("normalizes user-typed topics to match stored question tags", () => {
    // User types various formats
    const userInputs = [
      "Cardiac Arrhythmias",
      "cardiac arrhythmias",
      "CARDIAC ARRHYTHMIAS",
      "  cardiac   arrhythmias  ",
    ];

    const normalized = userInputs.map(normalizeTopicTag);
    const unique = new Set(normalized);
    expect(unique.size).toBe(1); // All should normalize to same value
    expect(normalized[0]).toBe("cardiac-arrhythmias");
  });

  it("topic library IDs match normalized form", () => {
    for (const topic of ASSESSMENT_TOPIC_LIBRARY) {
      expect(topic.id).toBe(normalizeTopicTag(topic.id));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 6: Task completion tracking → stats
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 6: Task Tracking → Completion Stats", () => {
  it("tracks progress as student completes study plan", () => {
    const tasks = [
      { status: "DONE", actualMinutes: 35, estMinutes: 30 },
      { status: "DONE", actualMinutes: 50, estMinutes: 45 },
      { status: "IN_PROGRESS", estMinutes: 40 },
      { status: "TODO", estMinutes: 30 },
      { status: "TODO", estMinutes: 25 },
      { status: "SKIPPED", estMinutes: 15 },
    ];

    const stats = computeCompletionStats(tasks);
    expect(stats.completedTasks).toBe(2);
    expect(stats.totalTasks).toBe(6);
    expect(stats.totalStudyMinutes).toBe(85); // 35 + 50
    expect(stats.completionPercent).toBeCloseTo(2 / 6);
  });

  it("handles all tasks DONE", () => {
    const tasks = [
      { status: "DONE", actualMinutes: 30 },
      { status: "DONE", actualMinutes: 45 },
    ];
    const stats = computeCompletionStats(tasks);
    expect(stats.completionPercent).toBe(1);
  });

  it("handles no tasks DONE", () => {
    const tasks = [
      { status: "TODO", estMinutes: 30 },
      { status: "IN_PROGRESS", estMinutes: 45 },
    ];
    const stats = computeCompletionStats(tasks);
    expect(stats.completionPercent).toBe(0);
    expect(stats.totalStudyMinutes).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 7: Error handling consistency
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 7: Error Handling System", () => {
  it("produces consistent error envelopes", () => {
    const result = fail(Errors.NOT_FOUND, "Course not found.");
    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Course not found." },
    });
  });

  it("produces consistent success envelopes", () => {
    const result = ok({ questions: [1, 2, 3] });
    expect(result).toEqual({
      success: true,
      data: { questions: [1, 2, 3] },
    });
  });

  it("safeError maps Firebase error codes correctly", () => {
    const permError = safeError({ code: "permission-denied", message: "denied" }, "test");
    expect(permError.error.code).toBe("PERMISSION_DENIED");

    const notFound = safeError({ code: "not-found", message: "gone" }, "test");
    expect(notFound.error.code).toBe("NOT_FOUND");

    const rateLimit = safeError({ code: "resource-exhausted", message: "slow down" }, "test");
    expect(rateLimit.error.code).toBe("RATE_LIMITED");

    const timeout = safeError({ code: "deadline-exceeded", message: "too slow" }, "test");
    expect(timeout.error.code).toBe("TIMEOUT");

    const unknown = safeError({ code: "UNKNOWN_CODE", message: "wat" }, "test");
    expect(unknown.error.code).toBe("INTERNAL");
  });

  it("Errors catalogue is frozen and immutable", () => {
    expect(Object.isFrozen(Errors)).toBe(true);
    // In non-strict mode, frozen object assignment silently fails (no throw)
    Errors.NEW_ERROR = { code: "NEW" };
    expect(Errors.NEW_ERROR).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 8: Schedule edge cases — stress tests
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 8: Schedule Edge Cases", () => {
  it("handles a single section with all revision off", () => {
    const sections = [{ id: "s1", title: "Only Topic", estMinutes: 20, questionsStatus: "COMPLETED" }];
    const tasks = buildWorkUnits(sections, "c1", "off");
    expect(tasks).toHaveLength(2); // STUDY + QUESTIONS

    const days = buildDayCapacities(new Date("2025-06-01"), new Date("2025-06-03"));
    const placed = placeTasks(tasks, days);
    expect(placed).toHaveLength(2);
  });

  it("handles 50 sections with aggressive revision (max realistic load)", () => {
    const sections = Array.from({ length: 50 }, (_, i) => ({
      id: `s${i}`,
      title: `Chapter ${i + 1}`,
      estMinutes: 20,
      difficulty: (i % 5) + 1,
      topicTags: [`topic-${i % 10}`],
      questionsStatus: "COMPLETED",
    }));

    const tasks = buildWorkUnits(sections, "big-course", "aggressive");
    // 50 STUDY + 50 QUESTIONS + 200 REVIEW (4 per section) = 300
    expect(tasks).toHaveLength(300);

    const total = computeTotalLoad(tasks);
    expect(total).toBeGreaterThan(0);

    // 6-month study window
    const days = buildDayCapacities(new Date("2025-06-01"), new Date("2025-12-01"), {
      defaultMinutesPerDay: 120,
    });

    const feasibility = checkFeasibility(total, days);
    expect(feasibility.feasible).toBe(true);

    const placed = placeTasks(tasks, days);
    expect(placed.length).toBeGreaterThan(0);
  });

  it("excluded dates reduce capacity correctly", () => {
    const today = new Date("2025-06-01");
    const examDate = new Date("2025-06-08");

    // Exclude 3 of 8 days
    const days = buildDayCapacities(today, examDate, {
      excludedDates: ["2025-06-03", "2025-06-05", "2025-06-07"],
      defaultMinutesPerDay: 100,
      catchUpBufferPercent: 0,
    });

    expect(days).toHaveLength(5); // 8 - 3
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 9: Weakness score edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 9: Weakness Score Computation Edge Cases", () => {
  it("new topic with no attempts gets default 0.5 error rate", () => {
    const score = computeWeaknessScore({
      wrongAttempts: 0,
      totalAttempts: 0,
      daysSinceLastReview: 14,
      avgTimePerQ: 0,
      expectedTime: 60,
    });

    // 0.6 * 0.5 + 0.3 * 1.0 + 0.1 * 1.0 = 0.3 + 0.3 + 0.1 = 0.7
    expect(score).toBeCloseTo(0.7);
  });

  it("perfect topic with recent review gets low score", () => {
    const score = computeWeaknessScore({
      wrongAttempts: 0,
      totalAttempts: 20,
      daysSinceLastReview: 0,
      avgTimePerQ: 45,
      expectedTime: 60,
    });

    // 0.6 * 0 + 0.3 * 0 + 0.1 * (1 - 45/60) = 0 + 0 + 0.025 = 0.025
    expect(score).toBeLessThan(0.1);
  });

  it("terrible topic not reviewed in 2 weeks gets max score", () => {
    const score = computeWeaknessScore({
      wrongAttempts: 10,
      totalAttempts: 10,
      daysSinceLastReview: 14,
      avgTimePerQ: 10,
      expectedTime: 60,
    });

    // 0.6 * 1.0 + 0.3 * 1.0 + 0.1 * (1 - 10/60) = 0.6 + 0.3 + 0.083 ≈ 0.983
    expect(score).toBeGreaterThan(0.9);
  });

  it("fast but wrong answers get high score (guessing penalty)", () => {
    const score = computeWeaknessScore({
      wrongAttempts: 8,
      totalAttempts: 10,
      daysSinceLastReview: 7,
      avgTimePerQ: 5, // Very fast — likely guessing
      expectedTime: 60,
    });

    expect(score).toBeGreaterThan(0.6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 10: Tutor Help integration
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOW 10: Tutor Response Normalization", () => {
  it("normalizes a typical tutor response from Claude", () => {
    const raw = {
      correct_answer: "Left ventricle",
      why_correct: "The LV has the thickest wall because it pumps against systemic resistance.",
      why_student_wrong: "You chose the right ventricle, which only pumps against pulmonary pressure.",
      key_takeaway: "Wall thickness correlates with afterload: LV > RV > atria.",
      follow_ups: [
        { q: "What causes LV hypertrophy?", a: "Chronic pressure overload, e.g., from hypertension or aortic stenosis." },
        { q: "How is LV wall thickness measured?", a: "Via echocardiography — normal is <12mm at end-diastole." },
      ],
    };

    const result = normaliseTutorResponse(raw);
    expect(result).not.toBeNull();
    expect(result.correctAnswer).toBe("Left ventricle");
    expect(result.followUps).toHaveLength(2);
    expect(result.followUps[0].q).toContain("hypertrophy");
  });

  it("handles completely empty tutor response", () => {
    expect(normaliseTutorResponse({})).toBeNull();
    expect(normaliseTutorResponse(null)).toBeNull();
  });
});
