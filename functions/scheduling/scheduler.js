/**
 * @module scheduling/scheduler
 * @description Pure scheduling algorithm — no Firebase dependencies.
 *
 * This module contains the core study-plan logic extracted from the callable
 * `generateSchedule` function so that it can be unit-tested without mocking
 * Firestore.  Every function is a pure transformation of plain objects.
 *
 * Pipeline:
 *   sections  →  buildWorkUnits  →  tasks
 *   tasks     →  computeTotalLoad →  minutes
 *   config    →  buildDayCapacities →  days[]
 *   (tasks, days) →  placeTasks  →  placedTasks[]
 */

const {
  MS_PER_DAY,
  REVISION_POLICIES,
  VALID_REVISION_POLICIES,
  DEFAULT_MINUTES_PER_DAY,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  MAX_SCHEDULE_DAYS,
  DEFAULT_STUDY_PERIOD_DAYS,
} = require("../lib/constants");
const { clampInt, truncate, toISODate, weekdayName } = require("../lib/utils");

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SectionInput
 * @property {string}   id
 * @property {string}   title
 * @property {number}   [estMinutes=15]
 * @property {number}   [difficulty=3]
 * @property {string[]} [topicTags=[]]
 * @property {string}   [questionsStatus] - "PENDING"|"GENERATING"|"COMPLETED"|"FAILED"
 */

/**
 * @typedef {Object} AvailabilityConfig
 * @property {number}  [defaultMinutesPerDay=120]
 * @property {Object<string,number>} [perDayOverrides] - e.g. `{ monday: 60 }`
 * @property {string[]} [excludedDates] - ISO date strings to skip.
 * @property {number}  [catchUpBufferPercent=15] - 0–50; reserved for catch-up.
 */

/**
 * @typedef {Object} WorkUnit
 * @property {string}   courseId
 * @property {"STUDY"|"QUESTIONS"|"REVIEW"} type
 * @property {string}   title
 * @property {string[]} sectionIds
 * @property {string[]} topicTags
 * @property {number}   estMinutes
 * @property {number}   difficulty
 * @property {string}   status
 * @property {boolean}  isPinned
 * @property {number}   priority
 * @property {number}   [sourceOrder] - Section order in the course sequence.
 * @property {number}   [_dayOffset] - Internal: review offset from study day.
 */

/**
 * @typedef {Object} DaySlot
 * @property {Date}   date
 * @property {number} usableCapacity - Minutes available after catch-up buffer.
 * @property {number} remaining      - Minutes not yet allocated.
 */

/**
 * @typedef {Object} PlacedTask
 * @property {Date}   dueDate
 * @property {number} orderIndex
 */

// ── Step A: build work units ─────────────────────────────────────────────────

/**
 * Convert a list of sections into STUDY, QUESTIONS, and REVIEW work units.
 *
 * @param {SectionInput[]} sections
 * @param {string} courseId
 * @param {string} [revisionPolicy="standard"]
 * @returns {WorkUnit[]}
 */
function buildWorkUnits(sections, courseId, revisionPolicy = "standard") {
  const policy = VALID_REVISION_POLICIES.has(revisionPolicy) ? revisionPolicy : "standard";
  const tasks = [];

  for (const [sourceOrder, section] of sections.entries()) {
    const estMinutes = clampInt(section.estMinutes || 15, 5, 240);
    const difficulty = clampInt(section.difficulty || 3, 1, 5);
    const title = truncate(section.title, 200);
    const topicTags = (section.topicTags || []).slice(0, 10);
    const base = {
      courseId,
      sectionIds: [section.id],
      topicTags,
      difficulty,
      status: "TODO",
      isPinned: false,
      priority: 0,
      sourceOrder,
    };

    tasks.push({ ...base, type: "STUDY", title: `Study: ${title}`, estMinutes });

    // CRITICAL: Only create QUESTIONS task if questions are actually generated
    if (section.questionsStatus === "COMPLETED") {
      tasks.push({ ...base, type: "QUESTIONS", title: `Questions: ${title}`, estMinutes: Math.max(8, Math.round(estMinutes * 0.35)) });
    }

    for (const review of REVISION_POLICIES[policy]) {
      tasks.push({ ...base, type: "REVIEW", title: `Review: ${title}`, estMinutes: review.minutes, _dayOffset: review.dayOffset });
    }
  }

  return tasks;
}

// ── Step B: total load ───────────────────────────────────────────────────────

/**
 * Sum the estimated minutes across all work units.
 *
 * @param {WorkUnit[]} tasks
 * @returns {number}
 */
function computeTotalLoad(tasks) {
  return tasks.reduce((sum, t) => sum + t.estMinutes, 0);
}

// ── Step C: build day capacities ─────────────────────────────────────────────

/**
 * Build an array of day-slots between today and the end date, respecting
 * per-day overrides, excluded dates, and the catch-up buffer.
 *
 * @param {Date}               today
 * @param {Date|null}          examDate
 * @param {AvailabilityConfig} [availability={}]
 * @returns {DaySlot[]}
 */
function buildDayCapacities(today, examDate, availability = {}) {
  const endDate = examDate || new Date(today.getTime() + DEFAULT_STUDY_PERIOD_DAYS * MS_PER_DAY);
  const defaultMinutes = clampInt(availability.defaultMinutesPerDay ?? DEFAULT_MINUTES_PER_DAY, MIN_DAILY_MINUTES, MAX_DAILY_MINUTES);
  const excludedDates = new Set((availability.excludedDates || []).slice(0, 365));
  const catchUpBuffer = clampInt(availability.catchUpBufferPercent ?? 15, 0, 50) / 100;

  const days = [];
  let cursor = new Date(today);
  let dayCount = 0;

  while (cursor <= endDate && dayCount < MAX_SCHEDULE_DAYS) {
    const iso = toISODate(cursor);
    const dayName = weekdayName(cursor);

    if (!excludedDates.has(iso)) {
      const override = (availability.perDayOverrides ?? availability.perDay)?.[dayName];
      const capacity = override != null ? clampInt(override, 0, MAX_DAILY_MINUTES) : defaultMinutes;
      const usable = Math.floor(capacity * (1 - catchUpBuffer));
      days.push({ date: new Date(cursor), usableCapacity: usable, remaining: usable });
    }

    cursor = new Date(cursor.getTime() + MS_PER_DAY);
    dayCount++;
  }

  return days;
}

// ── Step D: feasibility check ────────────────────────────────────────────────

/**
 * Check whether the total workload fits within the available capacity.
 *
 * @param {number}    totalMinutes
 * @param {DaySlot[]} days
 * @returns {{ feasible: boolean, deficit: number }}
 */
function checkFeasibility(totalMinutes, days) {
  const totalUsable = days.reduce((sum, d) => sum + d.usableCapacity, 0);
  return {
    feasible: totalMinutes <= totalUsable,
    deficit: Math.max(0, totalMinutes - totalUsable),
  };
}

// ── Step E + F: place tasks ──────────────────────────────────────────────────

/**
 * Place work units onto day-slots using a balanced-fill heuristic.
 *
 * Study and question tasks are placed first in section order, then review tasks
 * are anchored at their spaced-repetition offset from the corresponding study
 * task's day.
 *
 * @param {WorkUnit[]} tasks
 * @param {DaySlot[]}  days  - **Mutated**: `remaining` is decremented.
 * @returns {PlacedTask[]} Tasks with `dueDate` and `orderIndex` assigned.
 */
function placeTasks(tasks, days) {
  const studyTasks = tasks.filter((t) => t.type === "STUDY" || t.type === "QUESTIONS");
  const reviewTasks = tasks.filter((t) => t.type === "REVIEW");
  const maxDayCapacity = days.reduce((max, d) => Math.max(max, d.usableCapacity), 0);

  // Keep an intentional learning flow by defaulting to section order.
  studyTasks.sort((a, b) => {
    const orderA = a.sourceOrder ?? 0;
    const orderB = b.sourceOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return b.difficulty - a.difficulty;
  });

  let dayIndex = 0;
  let orderIndex = 0;
  const placed = [];

  // Split oversized tasks so they can be distributed across multiple days.
  const expandTask = (task) => {
    if (maxDayCapacity <= 0 || task.estMinutes <= maxDayCapacity) return [task];
    const parts = [];
    let remaining = task.estMinutes;
    let part = 1;
    while (remaining > 0) {
      const chunk = Math.min(maxDayCapacity, remaining);
      parts.push({
        ...task,
        estMinutes: chunk,
        title: `${task.title} (Part ${part})`,
      });
      remaining -= chunk;
      part++;
    }
    return parts;
  };

  // Place study + question tasks.
  for (const originalTask of studyTasks) {
    for (const task of expandTask(originalTask)) {
      // Find first day with enough remaining capacity.
      let targetDay = dayIndex;
      while (targetDay < days.length && days[targetDay].remaining < task.estMinutes) {
        targetDay++;
      }

      if (targetDay >= days.length) continue;

      if (targetDay !== dayIndex) {
        dayIndex = targetDay;
        orderIndex = 0;
      }

      placed.push({ ...task, dueDate: days[dayIndex].date, orderIndex: orderIndex++ });
      days[dayIndex].remaining -= task.estMinutes;
    }
  }

  // Place review tasks at offset from their study task's day
  for (const task of reviewTasks) {
    const studyTask = placed.find((t) => t.type === "STUDY" && t.sectionIds[0] === task.sectionIds[0]);
    if (!studyTask) continue;

    const studyDayIdx = days.findIndex((d) => d.date.getTime() === studyTask.dueDate.getTime());
    if (studyDayIdx === -1) continue;

    const targetIdx = Math.min(studyDayIdx + (task._dayOffset || 1), days.length - 1);
    const { _dayOffset, ...cleanTask } = task;
    placed.push({ ...cleanTask, dueDate: days[targetIdx].date, orderIndex: 0 });
  }

  return placed;
}

module.exports = {
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
};
