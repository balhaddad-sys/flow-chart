/**
 * @module scheduling/distributor
 * @description Pure catch-up redistribution algorithm — no Firebase dependencies.
 *
 * Given a set of overdue tasks, distributes them evenly across a span of
 * future days.  Extracted so it can be unit-tested in isolation.
 */

const { MS_PER_DAY, CATCH_UP_SPAN_DAYS } = require("../lib/constants");

/**
 * @typedef {Object} RedistributedTask
 * @property {*}    ref      - Opaque reference (Firestore doc ref or test stub).
 * @property {Date} newDate  - The reassigned due date.
 * @property {number} priority - Elevated priority for catch-up items.
 */

// Task type ordering: STUDY before QUESTIONS before REVIEW so that
// redistributed tasks maintain a pedagogically sound sequence.
const TYPE_ORDER = { STUDY: 0, QUESTIONS: 1, REVIEW: 2 };

/**
 * Distribute overdue items across the next N days.
 *
 * When `dayCapacities` is provided, tasks are placed respecting each day's
 * remaining minutes.  Otherwise falls back to a simple even split.
 *
 * Tasks are sorted so STUDY tasks precede their QUESTIONS/REVIEW counterparts,
 * and higher-priority tasks are placed first within each type group. The
 * original adaptive priority is preserved (boosted by +1) instead of being
 * flattened to a uniform value.
 *
 * @param {Array<{ ref: *, estMinutes?: number, type?: string, priority?: number }>} overdueItems - Items to redistribute.
 * @param {Date}   today     - Start of today (midnight).
 * @param {number} [spanDays=CATCH_UP_SPAN_DAYS] - How many future days to spread across.
 * @param {Array<{ date: Date, remaining: number }>} [dayCapacities] - Optional capacity-aware slots.
 * @returns {RedistributedTask[]}
 */
function distributeOverdue(overdueItems, today, spanDays = CATCH_UP_SPAN_DAYS, dayCapacities = null) {
  if (overdueItems.length === 0) return [];

  // Sort: by type (STUDY → QUESTIONS → REVIEW), then by priority descending
  const sorted = [...overdueItems].sort((a, b) => {
    const typeA = TYPE_ORDER[a.type] ?? 1;
    const typeB = TYPE_ORDER[b.type] ?? 1;
    if (typeA !== typeB) return typeA - typeB;
    return (b.priority || 0) - (a.priority || 0);
  });

  // Capacity-aware distribution when day slots are provided.
  if (dayCapacities && dayCapacities.length > 0) {
    const caps = dayCapacities.map((c) => ({ date: c.date, remaining: c.remaining }));
    const result = [];
    let dayIdx = 0;

    for (const item of sorted) {
      const taskMinutes = item.estMinutes || 15;
      // Find next day with enough capacity (don't stop early at length - 1).
      const startIdx = dayIdx;
      while (dayIdx < caps.length && caps[dayIdx].remaining < taskMinutes) {
        dayIdx++;
      }
      // If no day has enough capacity, find the one with the most remaining.
      if (dayIdx >= caps.length) {
        let bestIdx = startIdx;
        let bestRemaining = caps[startIdx]?.remaining ?? 0;
        for (let d = startIdx; d < caps.length; d++) {
          if (caps[d].remaining > bestRemaining) {
            bestIdx = d;
            bestRemaining = caps[d].remaining;
          }
        }
        dayIdx = bestIdx;
      }
      // Preserve original priority with a +1 boost for catch-up urgency
      const boostedPriority = Math.min(100, (item.priority || 0) + 1);
      result.push({
        ref: item.ref,
        newDate: caps[dayIdx].date,
        priority: boostedPriority,
      });
      caps[dayIdx].remaining -= taskMinutes;
    }
    return result;
  }

  // Simple even-split fallback.
  const perDay = Math.ceil(sorted.length / spanDays);

  return sorted.map((item, idx) => {
    const dayOffset = Math.floor(idx / perDay) + 1;
    const boostedPriority = Math.min(100, (item.priority || 0) + 1);
    return {
      ref: item.ref,
      newDate: new Date(today.getTime() + dayOffset * MS_PER_DAY),
      priority: boostedPriority,
    };
  });
}

module.exports = { distributeOverdue };
