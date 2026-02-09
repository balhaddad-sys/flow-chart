const { computeWeaknessScore, weightedSelect } = require('../questions/questionSelection');

describe('questionSelection', () => {
  describe('computeWeaknessScore', () => {
    it('returns 0.5 for no attempts', () => {
      const score = computeWeaknessScore({});
      // Default wrongRate=0.5, recencyPenalty=1 (14 days), speedPenalty=1
      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns low score for high accuracy and recent review', () => {
      const score = computeWeaknessScore({
        wrongAttempts: 1,
        totalAttempts: 10,
        daysSinceLastReview: 0,
        avgTimePerQ: 60,
        expectedTime: 60,
      });
      expect(score).toBeLessThan(0.15);
    });

    it('returns high score for poor accuracy and old review', () => {
      const score = computeWeaknessScore({
        wrongAttempts: 8,
        totalAttempts: 10,
        daysSinceLastReview: 14,
        avgTimePerQ: 10,
        expectedTime: 60,
      });
      expect(score).toBeGreaterThan(0.7);
    });

    it('weights wrongRate most heavily (0.6)', () => {
      const highWrong = computeWeaknessScore({
        wrongAttempts: 10,
        totalAttempts: 10,
        daysSinceLastReview: 0,
        avgTimePerQ: 60,
        expectedTime: 60,
      });
      const lowWrong = computeWeaknessScore({
        wrongAttempts: 0,
        totalAttempts: 10,
        daysSinceLastReview: 0,
        avgTimePerQ: 60,
        expectedTime: 60,
      });
      expect(highWrong - lowWrong).toBeGreaterThan(0.5);
    });
  });

  describe('weightedSelect', () => {
    const questions = [
      { id: 'q1', topicTags: ['cardio'], stats: { timesAnswered: 5 } },
      { id: 'q2', topicTags: ['neuro'], stats: { timesAnswered: 3 } },
      { id: 'q3', topicTags: ['cardio'], stats: { timesAnswered: 0 } },
      { id: 'q4', topicTags: ['renal'], stats: { timesAnswered: 1 } },
    ];

    it('selects the requested number of questions', () => {
      const weaknesses = new Map([
        ['cardio', 0.8],
        ['neuro', 0.5],
        ['renal', 0.3],
      ]);
      const selected = weightedSelect(questions, weaknesses, 2);
      expect(selected).toHaveLength(2);
    });

    it('returns all if count exceeds pool', () => {
      const weaknesses = new Map([['cardio', 0.5]]);
      const selected = weightedSelect(questions, weaknesses, 10);
      expect(selected).toHaveLength(4);
    });

    it('avoids recently answered questions', () => {
      const weaknesses = new Map([['cardio', 0.5], ['neuro', 0.5], ['renal', 0.5]]);
      const recentlyAnswered = new Set(['q1', 'q2']);
      const results = [];
      // Run multiple times to check bias
      for (let i = 0; i < 20; i++) {
        const selected = weightedSelect(questions, weaknesses, 2, recentlyAnswered);
        results.push(...selected.map(s => s.id));
      }
      // q3 and q4 should appear much more frequently
      const q3Count = results.filter(id => id === 'q3').length;
      const q1Count = results.filter(id => id === 'q1').length;
      expect(q3Count).toBeGreaterThan(q1Count);
    });

    it('boosts never-answered questions', () => {
      const weaknesses = new Map([['cardio', 0.5]]);
      const results = [];
      for (let i = 0; i < 50; i++) {
        const selected = weightedSelect(questions, weaknesses, 1);
        results.push(selected[0].id);
      }
      // q3 (never answered) should appear more than q1 (answered 5 times)
      const q3Count = results.filter(id => id === 'q3').length;
      expect(q3Count).toBeGreaterThan(5);
    });
  });
});
