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

/**
 * Distribute overdue items across the next N days.
 *
 * When `dayCapacities` is provided, tasks are placed respecting each day's
 * remaining minutes.  Otherwise falls back to a simple even split.
 *
 * @param {Array<{ ref: *, estMinutes?: number }>} overdueItems - Items to redistribute.
 * @param {Date}   today     - Start of today (midnight).
 * @param {number} [spanDays=CATCH_UP_SPAN_DAYS] - How many future days to spread across.
 * @param {Array<{ date: Date, remaining: number }>} [dayCapacities] - Optional capacity-aware slots.
 * @returns {RedistributedTask[]}
 */
function distributeOverdue(overdueItems, today, spanDays = CATCH_UP_SPAN_DAYS, dayCapacities = null) {
  if (overdueItems.length === 0) return [];

  // Capacity-aware distribution when day slots are provided.
  if (dayCapacities && dayCapacities.length > 0) {
    const caps = dayCapacities.map((c) => ({ date: c.date, remaining: c.remaining }));
    const result = [];
    let dayIdx = 0;

    for (const item of overdueItems) {
      const taskMinutes = item.estMinutes || 15;
      // Find next day with enough capacity.
      while (dayIdx < caps.length - 1 && caps[dayIdx].remaining < taskMinutes) {
        dayIdx++;
      }
      result.push({
        ref: item.ref,
        newDate: caps[dayIdx].date,
        priority: 1,
      });
      caps[dayIdx].remaining -= taskMinutes;
    }
    return result;
  }

  // Simple even-split fallback.
  const perDay = Math.ceil(overdueItems.length / spanDays);

  return overdueItems.map((item, idx) => {
    const dayOffset = Math.floor(idx / perDay) + 1;
    return {
      ref: item.ref,
      newDate: new Date(today.getTime() + dayOffset * MS_PER_DAY),
      priority: 1,
    };
  });
}

module.exports = { distributeOverdue };
