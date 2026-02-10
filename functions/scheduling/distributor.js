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
 * Distribute overdue items evenly across the next N days.
 *
 * @param {Array<{ ref: * }>} overdueItems - Items to redistribute.
 * @param {Date}   today     - Start of today (midnight).
 * @param {number} [spanDays=CATCH_UP_SPAN_DAYS] - How many future days to spread across.
 * @returns {RedistributedTask[]}
 */
function distributeOverdue(overdueItems, today, spanDays = CATCH_UP_SPAN_DAYS) {
  if (overdueItems.length === 0) return [];

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
