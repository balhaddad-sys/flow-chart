const {
  FSRS_WEIGHTS,
  CARD_STATES,
  GRADE,
  clamp,
  retrievability,
  nextInterval,
  initStability,
  initDifficulty,
  nextDifficulty,
  recallStability,
  forgetStability,
  reviewCard,
  createBlankCard,
  gradeFromPerformance,
} = require("../lib/fsrs");

describe("lib/fsrs — FSRS v5 Algorithm", () => {
  // ── retrievability ──────────────────────────────────────────────────────────

  describe("retrievability", () => {
    it("returns 1 when no time has elapsed", () => {
      expect(retrievability(0, 10)).toBe(1);
    });

    it("returns 0 when stability is 0", () => {
      expect(retrievability(5, 0)).toBe(0);
    });

    it("returns ~0.9 at t = S (by FSRS formula)", () => {
      // R = (1 + t/(9·S))^(-1), at t = S → R = (1 + 1/9)^(-1) = 9/10 = 0.9
      expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
    });

    it("decays over time", () => {
      const r1 = retrievability(1, 10);
      const r7 = retrievability(7, 10);
      const r30 = retrievability(30, 10);
      expect(r1).toBeGreaterThan(r7);
      expect(r7).toBeGreaterThan(r30);
    });

    it("higher stability = slower decay", () => {
      const rLow = retrievability(10, 5);
      const rHigh = retrievability(10, 50);
      expect(rHigh).toBeGreaterThan(rLow);
    });
  });

  // ── nextInterval ────────────────────────────────────────────────────────────

  describe("nextInterval", () => {
    it("computes interval from stability and desired retention", () => {
      // I = S · 9 · (1/0.9 - 1) = S · 9 · (1/9) = S
      // So at 90% retention, interval ≈ stability
      const interval = nextInterval(10, 0.9);
      expect(interval).toBe(10);
    });

    it("clamps to minInterval", () => {
      expect(nextInterval(0.01, 0.9, 1, 365)).toBe(1);
    });

    it("clamps to maxInterval", () => {
      expect(nextInterval(1000, 0.9, 1, 365)).toBe(365);
    });

    it("lower retention = longer intervals", () => {
      const i90 = nextInterval(10, 0.9, 1, 10000);
      const i80 = nextInterval(10, 0.8, 1, 10000);
      expect(i80).toBeGreaterThan(i90);
    });

    it("returns minInterval for invalid inputs", () => {
      expect(nextInterval(0, 0.9)).toBe(1);
      expect(nextInterval(10, 0)).toBe(1);
      expect(nextInterval(10, 1)).toBe(1);
    });
  });

  // ── initStability ───────────────────────────────────────────────────────────

  describe("initStability", () => {
    it("uses w0 for Again grade", () => {
      expect(initStability(1)).toBeCloseTo(FSRS_WEIGHTS[0], 3);
    });

    it("uses w3 for Easy grade", () => {
      expect(initStability(4)).toBeCloseTo(FSRS_WEIGHTS[3], 3);
    });

    it("higher grade = higher initial stability", () => {
      expect(initStability(4)).toBeGreaterThan(initStability(3));
      expect(initStability(3)).toBeGreaterThan(initStability(2));
      expect(initStability(2)).toBeGreaterThan(initStability(1));
    });

    it("never returns less than 0.1", () => {
      expect(initStability(1, [0, 0, 0, 0])).toBe(0.1);
    });
  });

  // ── initDifficulty ──────────────────────────────────────────────────────────

  describe("initDifficulty", () => {
    it("returns difficulty between 1 and 10", () => {
      for (let g = 1; g <= 4; g++) {
        const d = initDifficulty(g);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(10);
      }
    });

    it("Again = highest difficulty, Easy = lowest", () => {
      expect(initDifficulty(1)).toBeGreaterThan(initDifficulty(4));
    });
  });

  // ── nextDifficulty ──────────────────────────────────────────────────────────

  describe("nextDifficulty", () => {
    it("stays in [1, 10]", () => {
      expect(nextDifficulty(1, 1)).toBeGreaterThanOrEqual(1);
      expect(nextDifficulty(10, 4)).toBeLessThanOrEqual(10);
    });

    it("Again increases difficulty", () => {
      const d = 5;
      expect(nextDifficulty(d, GRADE.Again)).toBeGreaterThan(d);
    });

    it("Easy decreases difficulty", () => {
      const d = 5;
      expect(nextDifficulty(d, GRADE.Easy)).toBeLessThan(d);
    });

    it("Good keeps difficulty roughly stable", () => {
      const d = 5;
      const dNext = nextDifficulty(d, GRADE.Good);
      // Should be close to original (mean-reversion toward D0(3))
      expect(Math.abs(dNext - d)).toBeLessThan(2);
    });
  });

  // ── recallStability ─────────────────────────────────────────────────────────

  describe("recallStability", () => {
    it("stability grows after Good recall", () => {
      const S = 10;
      const D = 5;
      const R = 0.9;
      const newS = recallStability(D, S, R, GRADE.Good);
      expect(newS).toBeGreaterThan(S);
    });

    it("Easy gives bigger stability boost than Good", () => {
      const S = 10;
      const D = 5;
      const R = 0.9;
      const sGood = recallStability(D, S, R, GRADE.Good);
      const sEasy = recallStability(D, S, R, GRADE.Easy);
      expect(sEasy).toBeGreaterThan(sGood);
    });

    it("Hard gives smaller stability boost than Good", () => {
      const S = 10;
      const D = 5;
      const R = 0.9;
      const sGood = recallStability(D, S, R, GRADE.Good);
      const sHard = recallStability(D, S, R, GRADE.Hard);
      expect(sHard).toBeLessThan(sGood);
    });

    it("never returns less than 0.1", () => {
      expect(recallStability(10, 0.001, 1, GRADE.Hard)).toBeGreaterThanOrEqual(0.1);
    });
  });

  // ── forgetStability ─────────────────────────────────────────────────────────

  describe("forgetStability", () => {
    it("stability decreases after a lapse", () => {
      const S = 20;
      const newS = forgetStability(5, S, 0.5);
      expect(newS).toBeLessThan(S);
    });

    it("never exceeds previous stability", () => {
      const S = 5;
      expect(forgetStability(1, S, 0.1)).toBeLessThanOrEqual(S);
    });

    it("never goes below 0.1", () => {
      expect(forgetStability(10, 0.1, 0.01)).toBeGreaterThanOrEqual(0.1);
    });
  });

  // ── reviewCard ──────────────────────────────────────────────────────────────

  describe("reviewCard", () => {
    it("initializes a new card on first review", () => {
      const card = createBlankCard("s1", "c1");
      const updated = reviewCard(card, GRADE.Good, 0, 0.9);

      expect(updated.state).toBe(CARD_STATES.Review);
      expect(updated.reps).toBe(1);
      expect(updated.lapses).toBe(0);
      expect(updated.stability).toBeGreaterThan(0);
      expect(updated.difficulty).toBeGreaterThan(0);
      expect(updated.interval).toBeGreaterThanOrEqual(1);
      expect(updated.nextReview).toBeInstanceOf(Date);
    });

    it("first review with Again goes to Learning", () => {
      const card = createBlankCard("s1", "c1");
      const updated = reviewCard(card, GRADE.Again, 0, 0.9);

      expect(updated.state).toBe(CARD_STATES.Learning);
      expect(updated.lapses).toBe(1);
    });

    it("subsequent Good review stays in Review with growing stability", () => {
      const card = {
        state: CARD_STATES.Review,
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 0,
        interval: 10,
        lastReview: new Date(Date.now() - 10 * 86_400_000),
      };

      const updated = reviewCard(card, GRADE.Good, 10, 0.9);
      expect(updated.state).toBe(CARD_STATES.Review);
      expect(updated.stability).toBeGreaterThan(card.stability);
      expect(updated.reps).toBe(4);
    });

    it("lapse transitions to Relearning", () => {
      const card = {
        state: CARD_STATES.Review,
        stability: 20,
        difficulty: 5,
        reps: 5,
        lapses: 0,
        interval: 20,
        lastReview: new Date(Date.now() - 20 * 86_400_000),
      };

      const updated = reviewCard(card, GRADE.Again, 20, 0.9);
      expect(updated.state).toBe(CARD_STATES.Relearning);
      expect(updated.lapses).toBe(1);
      expect(updated.stability).toBeLessThan(card.stability);
    });

    it("interval is always between min and max", () => {
      const card = createBlankCard("s1", "c1");
      for (let g = 1; g <= 4; g++) {
        const updated = reviewCard(card, g, 0, 0.9, 1, 365);
        expect(updated.interval).toBeGreaterThanOrEqual(1);
        expect(updated.interval).toBeLessThanOrEqual(365);
      }
    });

    it("Easy first review produces longest initial interval", () => {
      const card = createBlankCard("s1", "c1");
      const easy = reviewCard(card, GRADE.Easy, 0, 0.9);
      const good = reviewCard(card, GRADE.Good, 0, 0.9);
      const hard = reviewCard(card, GRADE.Hard, 0, 0.9);
      const again = reviewCard(card, GRADE.Again, 0, 0.9);

      expect(easy.interval).toBeGreaterThanOrEqual(good.interval);
      expect(good.interval).toBeGreaterThanOrEqual(hard.interval);
      expect(hard.interval).toBeGreaterThanOrEqual(again.interval);
    });
  });

  // ── createBlankCard ─────────────────────────────────────────────────────────

  describe("createBlankCard", () => {
    it("creates a card in New state", () => {
      const card = createBlankCard("s1", "c1");
      expect(card.state).toBe(CARD_STATES.New);
      expect(card.sectionId).toBe("s1");
      expect(card.courseId).toBe("c1");
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.stability).toBe(0);
    });
  });

  // ── gradeFromPerformance ────────────────────────────────────────────────────

  describe("gradeFromPerformance", () => {
    it("returns Again for accuracy < 40%", () => {
      expect(gradeFromPerformance(0.20, 30, 3)).toBe(GRADE.Again);
      expect(gradeFromPerformance(0.39, 30, 3)).toBe(GRADE.Again);
    });

    it("returns Hard for accuracy 40-65%", () => {
      expect(gradeFromPerformance(0.45, 30, 3)).toBe(GRADE.Hard);
      expect(gradeFromPerformance(0.60, 30, 3)).toBe(GRADE.Hard);
    });

    it("returns Hard for very slow answers even with decent accuracy", () => {
      expect(gradeFromPerformance(0.70, 100, 3)).toBe(GRADE.Hard);
    });

    it("returns Good for accuracy 65-90%", () => {
      expect(gradeFromPerformance(0.75, 30, 3)).toBe(GRADE.Good);
      expect(gradeFromPerformance(0.85, 30, 3)).toBe(GRADE.Good);
    });

    it("returns Easy for high accuracy + fast + confident", () => {
      expect(gradeFromPerformance(0.95, 20, 5)).toBe(GRADE.Easy);
    });

    it("returns Good (not Easy) if accuracy > 90% but slow", () => {
      expect(gradeFromPerformance(0.95, 60, 5)).toBe(GRADE.Good);
    });

    it("returns Good (not Easy) if accuracy > 90% but low confidence", () => {
      expect(gradeFromPerformance(0.95, 20, 2)).toBe(GRADE.Good);
    });

    it("handles edge cases gracefully", () => {
      expect(gradeFromPerformance(0, 0, 0)).toBe(GRADE.Again);
      expect(gradeFromPerformance(1, 10, 5)).toBe(GRADE.Easy);
    });
  });

  // ── Simulation: multiple reviews ──────────────────────────────────────────

  describe("simulation — multi-review progression", () => {
    it("stability grows over repeated Good reviews", () => {
      let card = createBlankCard("s1", "c1");
      const stabilities = [];

      // Simulate 5 reviews, each with Good grade
      let elapsed = 0;
      for (let i = 0; i < 5; i++) {
        card = reviewCard(card, GRADE.Good, elapsed, 0.9);
        stabilities.push(card.stability);
        elapsed = card.interval; // review exactly on schedule
      }

      // Stability should grow monotonically
      for (let i = 1; i < stabilities.length; i++) {
        expect(stabilities[i]).toBeGreaterThan(stabilities[i - 1]);
      }
    });

    it("lapse reduces stability but recovery is possible", () => {
      let card = createBlankCard("s1", "c1");

      // Build up stability with 3 Good reviews
      let elapsed = 0;
      for (let i = 0; i < 3; i++) {
        card = reviewCard(card, GRADE.Good, elapsed, 0.9);
        elapsed = card.interval;
      }
      const peakStability = card.stability;

      // Lapse
      card = reviewCard(card, GRADE.Again, elapsed, 0.9);
      expect(card.stability).toBeLessThan(peakStability);

      // Recover with Good reviews
      elapsed = card.interval;
      for (let i = 0; i < 3; i++) {
        card = reviewCard(card, GRADE.Good, elapsed, 0.9);
        elapsed = card.interval;
      }
      // Should be growing again (may or may not exceed peak yet)
      expect(card.stability).toBeGreaterThan(0);
      expect(card.reps).toBe(7);
    });
  });
});
