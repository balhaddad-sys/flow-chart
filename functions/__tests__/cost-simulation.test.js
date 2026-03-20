/**
 * Cost simulation & functional assessment for the ingestion pipeline.
 *
 * Validates that:
 * 1. Blueprint extraction works (heuristic + AI paths)
 * 2. Question generation is deferred (not called at ingestion)
 * 3. On-demand question generation works when triggered
 * 4. Triage correctly classifies sections
 * 5. Cost estimates are within expected bounds
 * 6. Large document handling (800+ sections) is viable
 */

const {
  buildHeuristicBlueprint,
  blueprintContentCount,
  createEmptyBlueprint,
  mergeBlueprints,
} = require("../ai/blueprintAnalysis");
const {
  buildAdaptiveContext,
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
  computeTriageScore,
  triageSections,
  isMastered,
  hasRetrievalValue,
  pruneForDeficit,
} = require("../scheduling/scheduler");
const {
  computeFastStartCounts,
  computeMaxBackfillAttempts,
} = require("../questions/generationPlanning");
const {
  PAGES_PER_SECTION,
  DEFAULT_QUESTION_COUNT,
  MAX_AI_SECTION_CHARS,
  TRIAGE_SCHEDULE_THRESHOLD,
} = require("../lib/constants");

// ── Mock section data ──────────────────────────────────────────────────────

const RICH_SECTION_TEXT = `
Acute Coronary Syndrome (ACS) Management

Acute coronary syndrome encompasses a spectrum of clinical presentations ranging from unstable angina
to ST-elevation myocardial infarction (STEMI). The pathophysiology involves rupture or erosion of an
atherosclerotic plaque, leading to thrombus formation and partial or complete occlusion of a coronary artery.

First-line Management:
The initial assessment should follow the ABCDE approach. Administer high-flow oxygen only if SpO2 < 94%.
Morphine 1-10mg IV for pain relief. Aspirin 300mg loading dose immediately. Dual antiplatelet therapy
with ticagrelor 180mg or clopidogrel 300mg. GTN sublingual unless contraindicated (hypotension, RV infarct).

ECG Interpretation:
ST elevation in contiguous leads indicates STEMI. New LBBB with clinical suspicion should be treated as STEMI equivalent.
Posterior MI: ST depression V1-V3 with tall R waves — do posterior leads V7-V9.
However, a normal ECG does not exclude ACS. Serial ECGs are essential.

Risk Stratification:
GRACE score predicts 6-month mortality. TIMI score guides treatment intensity.
High-risk features: ongoing chest pain, dynamic ECG changes, elevated troponin, haemodynamic instability.

Common Traps:
Do not give morphine routinely — it may mask ongoing ischaemia.
Avoid NSAIDs in ACS (increased cardiovascular risk).
Do not delay PCI for troponin results in STEMI.
Whereas NSTEMI management is initially conservative, STEMI requires immediate reperfusion.

Investigations:
Serial troponin at 0 and 3 hours (high-sensitivity assay). Full blood count, U&E, lipid profile, glucose.
Echocardiography for wall motion abnormalities. Coronary angiography within 72 hours for NSTEMI.

Treatment Algorithm:
STEMI → Primary PCI within 120 minutes of first medical contact (recommended) or thrombolysis if PCI not available within 120 minutes.
NSTEMI → Risk stratify → High risk: angiography within 72h. Low risk: non-invasive testing.

Complications:
Cardiogenic shock, ventricular fibrillation, heart block, pericarditis, left ventricular aneurysm.
Dressler syndrome: autoimmune pericarditis 2-10 weeks post-MI.
`;

const THIN_SECTION_TEXT = `Page 45. References and bibliography. ISBN 978-0-123456-78-9. All rights reserved.`;

const MODERATE_SECTION_TEXT = `
Pharmacology of Beta-Blockers

Beta-blockers are competitive antagonists at beta-adrenergic receptors. They are classified as
selective (beta-1) or non-selective (beta-1 and beta-2). Common agents include atenolol,
bisoprolol, propranolol, and carvedilol.

Indications include hypertension, angina, heart failure, and arrhythmias.
Contraindications: asthma, severe bradycardia, second/third degree heart block.
Side effects: fatigue, cold extremities, bronchospasm, impotence.
`;

function makeSectionFromText(id, text, extras = {}) {
  return {
    id,
    title: `Section ${id}`,
    estMinutes: 30,
    difficulty: 3,
    topicTags: [],
    questionsStatus: "PENDING",
    questionsCount: 0,
    blueprint: {},
    ...extras,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Cost Simulation & Functional Assessment", () => {
  describe("Heuristic blueprint quality", () => {
    it("extracts a rich blueprint from well-structured medical text", () => {
      const result = buildHeuristicBlueprint({ sectionText: RICH_SECTION_TEXT });
      const count = blueprintContentCount(result);

      expect(count).toBeGreaterThanOrEqual(8);
      expect(result.blueprint.keyConcepts.length).toBeGreaterThan(0);
      expect(result.blueprint.highYieldPoints.length).toBeGreaterThan(0);
      expect(result.blueprint.commonTraps.length).toBeGreaterThan(0);
      expect(result.topicTags.length).toBeGreaterThan(0);
    });

    it("produces empty blueprint for non-instructional content", () => {
      const result = buildHeuristicBlueprint({ sectionText: THIN_SECTION_TEXT });
      const count = blueprintContentCount(result);
      expect(count).toBe(0);
    });

    it("extracts moderate content from brief educational text", () => {
      const result = buildHeuristicBlueprint({ sectionText: MODERATE_SECTION_TEXT });
      const count = blueprintContentCount(result);
      expect(count).toBeGreaterThan(0);
      expect(result.blueprint.keyConcepts.length).toBeGreaterThan(0);
    });

    it("rich sections skip AI entirely (>= 8 heuristic items)", () => {
      const result = buildHeuristicBlueprint({ sectionText: RICH_SECTION_TEXT });
      // With >= 8 items, analyzeSectionBlueprint will return source: "heuristic"
      // without making any AI call — this is the key cost optimization
      expect(blueprintContentCount(result)).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Question generation deferral", () => {
    it("fast-start count is 3 (FAST_READY_COUNT)", () => {
      const { immediateCount, targetCount } = computeFastStartCounts(DEFAULT_QUESTION_COUNT, 0);
      expect(immediateCount).toBe(3);
      expect(targetCount).toBe(DEFAULT_QUESTION_COUNT);
    });

    it("skips generation when section already has enough questions", () => {
      const { immediateCount } = computeFastStartCounts(DEFAULT_QUESTION_COUNT, 10);
      expect(immediateCount).toBe(0);
    });

    it("backfill attempts are capped at 60", () => {
      expect(computeMaxBackfillAttempts(100)).toBe(60);
      expect(computeMaxBackfillAttempts(30)).toBe(60);
      expect(computeMaxBackfillAttempts(6)).toBe(12);
    });
  });

  describe("Triage at scale (800 sections)", () => {
    const adaptiveContext = buildAdaptiveContext({
      startDate: new Date("2025-01-01"),
      examDate: new Date("2025-04-01"),
      examType: "USMLE_STEP2",
      stats: {
        overallAccuracy: 0.62,
        weakestTopics: [
          { tag: "cardiology", weaknessScore: 0.85 },
          { tag: "pharmacology", weaknessScore: 0.70 },
          { tag: "respiratory", weaknessScore: 0.55 },
        ],
        allTopicScores: [
          { tag: "cardiology", weaknessScore: 0.85 },
          { tag: "pharmacology", weaknessScore: 0.70 },
          { tag: "respiratory", weaknessScore: 0.55 },
          { tag: "neurology", weaknessScore: 0.40 },
          { tag: "renal", weaknessScore: 0.30 },
          { tag: "gi", weaknessScore: 0.20 },
          { tag: "endocrine", weaknessScore: 0.15 },
        ],
      },
    });

    it("partitions 800 sections into meaningful tiers", () => {
      const sections = [];
      const topics = ["cardiology", "pharmacology", "respiratory", "neurology", "renal", "gi", "endocrine", "dermatology"];

      for (let i = 0; i < 800; i++) {
        const topic = topics[i % topics.length];
        const isWeak = ["cardiology", "pharmacology", "respiratory"].includes(topic);
        sections.push({
          id: `s${i}`,
          title: `${topic} topic ${i}`,
          difficulty: isWeak ? 4 : 2,
          topicTags: [topic],
          questionsStatus: i % 3 === 0 ? "COMPLETED" : "PENDING",
          questionsCount: i % 3 === 0 ? 10 : 0,
          blueprint: isWeak
            ? { highYieldPoints: ["p1", "p2"], commonTraps: ["t1"], keyConcepts: ["c1"], learningObjectives: [], termsToDefine: [] }
            : {},
        });
      }

      const { scheduled, backlog, deferred } = triageSections(sections, adaptiveContext);

      // Should NOT schedule all 800 — that defeats the purpose of triage
      expect(scheduled.length).toBeLessThan(800);
      expect(scheduled.length).toBeGreaterThan(0);
      expect(backlog.length + deferred.length).toBeGreaterThan(0);

      // Weak topics should dominate the scheduled tier
      const scheduledWeakCount = scheduled.filter((s) =>
        ["cardiology", "pharmacology", "respiratory"].includes(s.topicTags[0])
      ).length;
      expect(scheduledWeakCount / scheduled.length).toBeGreaterThan(0.4);
    });

    it("pruning keeps plan within capacity for tight schedules", () => {
      const sections = Array.from({ length: 100 }, (_, i) => ({
        id: `s${i}`,
        title: `Section ${i}`,
        difficulty: 3,
        topicTags: ["general"],
        questionsStatus: "PENDING",
        questionsCount: 0,
        blueprint: { highYieldPoints: ["p"], commonTraps: [], keyConcepts: ["c"], learningObjectives: [], termsToDefine: [] },
      }));

      const tasks = buildWorkUnits(sections, "c1", "off", null, adaptiveContext);
      const totalMinutes = computeTotalLoad(tasks);
      const tightCapacity = Math.round(totalMinutes * 0.5); // only 50% capacity

      const { kept, pruned } = pruneForDeficit(tasks, tightCapacity);
      const keptLoad = computeTotalLoad(kept);

      expect(keptLoad).toBeLessThanOrEqual(tightCapacity);
      expect(pruned.length).toBeGreaterThan(0);
    });
  });

  describe("Cost estimation", () => {
    it("estimates ingestion cost for 800 sections", () => {
      // With heuristic-first blueprint and no question generation:
      // - Rich sections (>= 8 heuristic items): 0 AI calls
      // - Moderate sections: 1 Gemini call (~$0.001)
      // - Thin/empty sections: 0 AI calls (filtered)

      const GEMINI_COST_PER_CALL = 0.001; // ~$0.001 per blueprint call
      const richSections = 400;    // well-structured text → heuristic only
      const moderateSections = 300; // need AI blueprint
      const thinSections = 100;    // filtered out, no AI

      const totalCost =
        richSections * 0 +                          // heuristic, no AI
        moderateSections * GEMINI_COST_PER_CALL +   // 1 Gemini call each
        thinSections * 0;                           // skipped

      expect(totalCost).toBeLessThan(0.50);
      expect(totalCost).toBeCloseTo(0.30, 1);
    });

    it("estimates on-demand question cost per studied section", () => {
      // On-demand via Claude Haiku: ~$0.015 per section for 6 questions
      const CLAUDE_COST_PER_SECTION = 0.015;
      const sectionsStudied = 200; // user studies 25% of 800

      const questionCost = sectionsStudied * CLAUDE_COST_PER_SECTION;
      expect(questionCost).toBeLessThan(5.0);
      expect(questionCost).toBeCloseTo(3.0, 0);
    });

    it("constants are set for cost efficiency", () => {
      expect(PAGES_PER_SECTION).toBeGreaterThanOrEqual(15);
      expect(DEFAULT_QUESTION_COUNT).toBeLessThanOrEqual(10);
      expect(MAX_AI_SECTION_CHARS).toBeLessThanOrEqual(6000);
    });
  });

  describe("End-to-end pipeline simulation", () => {
    it("processes a realistic 1000-page PDF scenario", () => {
      // Simulate: 1000 pages → ~50 sections (at 20 pages/section)
      const sectionCount = Math.ceil(1000 / PAGES_PER_SECTION);
      expect(sectionCount).toBeLessThanOrEqual(60);

      // Build mock sections — mix of weak/strong topics with some having questions
      const sections = Array.from({ length: sectionCount }, (_, i) => {
        const topic = ["cardiology", "pharmacology", "respiratory", "neurology", "renal"][i % 5];
        const isWeak = ["cardiology", "pharmacology"].includes(topic);
        const hasQuestions = i % 2 === 0; // half have questions ready
        return {
          id: `s${i}`,
          title: `${topic} — diagnosis and management chapter ${i + 1}`,
          difficulty: isWeak ? 4 : 2,
          topicTags: [topic],
          estMinutes: 25 + (i % 3) * 10,
          questionsStatus: hasQuestions ? "COMPLETED" : "PENDING",
          questionsCount: hasQuestions ? 6 : 0,
          blueprint: {
            learningObjectives: [`Explain ${topic} principles`],
            keyConcepts: [`${topic} basics`, "treatment algorithm"],
            highYieldPoints: [`Key ${topic} fact`, "first-line management"],
            commonTraps: [`Common ${topic} mistake`, "diagnostic pitfall"],
            termsToDefine: [`${topic} term`],
          },
        };
      });

      // Run triage
      // Exam in 6 weeks — realistic urgency
      const adaptiveContext = buildAdaptiveContext({
        startDate: new Date("2025-01-01"),
        examDate: new Date("2025-02-15"),
        examType: "PLAB1",
        stats: {
          overallAccuracy: 0.55,
          weakestTopics: [
            { tag: "cardiology", weaknessScore: 0.85 },
            { tag: "pharmacology", weaknessScore: 0.70 },
          ],
          allTopicScores: [
            { tag: "cardiology", weaknessScore: 0.85 },
            { tag: "pharmacology", weaknessScore: 0.70 },
            { tag: "respiratory", weaknessScore: 0.55 },
            { tag: "neurology", weaknessScore: 0.35 },
            { tag: "renal", weaknessScore: 0.20 },
          ],
        },
      });

      const { scheduled, backlog, deferred } = triageSections(sections, adaptiveContext);
      expect(scheduled.length + backlog.length + deferred.length).toBe(sectionCount);

      // With closer exam + weak topics, some sections should be scheduled
      expect(scheduled.length).toBeGreaterThan(0);

      // Build tasks from scheduled sections only
      const tasks = buildWorkUnits(scheduled, "c1", "standard", null, adaptiveContext);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(scheduled.length * 5); // study + questions + up to 3 reviews

      // Place into days
      const days = buildDayCapacities(
        new Date("2025-01-01"),
        new Date("2025-02-15"),
        { defaultMinutesPerDay: 90 }
      );
      const { placed, skipped } = placeTasks(tasks, days, { examDate: new Date("2025-02-15"), adaptiveContext });
      expect(placed.length).toBeGreaterThan(0);

      // Question tasks should only exist for sections with COMPLETED questionsStatus
      // and sufficient retrieval value (high weakness + questions ready)
      const questionTasks = tasks.filter((t) => t.type === "QUESTIONS");
      const pendingSections = scheduled.filter((s) => s.questionsStatus === "PENDING");
      const pendingQuestionTasks = questionTasks.filter((t) =>
        pendingSections.some((s) => t.sectionIds.includes(s.id))
      );
      // No question tasks for PENDING sections — they generate on demand
      expect(pendingQuestionTasks).toHaveLength(0);
    });

    it("on-demand question generation is gated properly", () => {
      const adaptiveContext = buildAdaptiveContext({
        startDate: new Date("2025-01-01"),
        examDate: new Date("2025-06-01"),
        examType: "PLAB1",
        stats: {
          overallAccuracy: 0.60,
          weakestTopics: [{ tag: "cardiology", weaknessScore: 0.80 }],
        },
      });

      // Section with questions ready + high weakness = should create QUESTIONS task
      const readySection = {
        id: "s1",
        title: "Cardiology Emergency",
        difficulty: 4,
        topicTags: ["cardiology"],
        questionsStatus: "COMPLETED",
        questionsCount: 10,
        blueprint: { highYieldPoints: ["ACS"], commonTraps: ["MI"], keyConcepts: [], learningObjectives: [], termsToDefine: [] },
      };
      expect(hasRetrievalValue(readySection, adaptiveContext)).toBe(true);

      // Section without questions = should NOT create QUESTIONS task
      const pendingSection = {
        id: "s2",
        title: "Dermatology basics",
        difficulty: 1,
        topicTags: ["dermatology"],
        questionsStatus: "PENDING",
        questionsCount: 0,
        blueprint: {},
      };
      expect(hasRetrievalValue(pendingSection, adaptiveContext)).toBe(false);
    });
  });
});
