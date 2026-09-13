import assert from "node:assert/strict";
import {
  FREE_WEEKLY_PLAN_GENERATIONS,
  getGenerationWeekKey,
  normalizeFreeGenerationUsage,
} from "../src/lib/premiumQuota.ts";

const monday = new Date(2026, 8, 7, 12);
const sunday = new Date(2026, 8, 13, 23, 59);
const nextMonday = new Date(2026, 8, 14, 0, 1);

assert.equal(getGenerationWeekKey(monday), "2026-09-07");
assert.equal(getGenerationWeekKey(sunday), "2026-09-07");
assert.equal(getGenerationWeekKey(nextMonday), "2026-09-14");
assert.equal(FREE_WEEKLY_PLAN_GENERATIONS, 3);

assert.deepEqual(normalizeFreeGenerationUsage(2, monday), {
  weekStart: "2026-09-07",
  count: 2,
});
assert.deepEqual(normalizeFreeGenerationUsage({ weekStart: "2026-09-07", count: 3 }, sunday), {
  weekStart: "2026-09-07",
  count: 3,
});
assert.deepEqual(normalizeFreeGenerationUsage({ weekStart: "2026-09-07", count: 3 }, nextMonday), {
  weekStart: "2026-09-14",
  count: 0,
});
assert.deepEqual(normalizeFreeGenerationUsage({ weekStart: "2026-09-14", count: -4 }, nextMonday), {
  weekStart: "2026-09-14",
  count: 0,
});

console.log("Premium weekly quota: all tests passed.");
