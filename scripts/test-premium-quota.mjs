import assert from "node:assert/strict";
import {
  FREE_WEEKLY_PLAN_GENERATIONS,
  FREE_DAILY_RECIPE_CREDITS,
  FREE_DAILY_RECEIPT_SCANS,
  FREE_HISTORY_ITEMS,
  FREE_COMMUNITY_RECIPE_ITEMS,
  getGenerationWeekKey,
  getLocalDateKey,
  getRecipeGenerationCost,
  normalizeDailyFeatureUsage,
  normalizeFreeGenerationUsage,
} from "../src/lib/premiumQuota.ts";
import { verifyPremiumTestPassword } from "../src/lib/premium/testAccess.ts";

const monday = new Date(2026, 8, 7, 12);
const sunday = new Date(2026, 8, 13, 23, 59);
const nextMonday = new Date(2026, 8, 14, 0, 1);

assert.equal(getGenerationWeekKey(monday), "2026-09-07");
assert.equal(getGenerationWeekKey(sunday), "2026-09-07");
assert.equal(getGenerationWeekKey(nextMonday), "2026-09-14");
assert.equal(FREE_WEEKLY_PLAN_GENERATIONS, 1);
assert.equal(FREE_DAILY_RECIPE_CREDITS, 3);
assert.equal(FREE_DAILY_RECEIPT_SCANS, 1);
assert.equal(FREE_HISTORY_ITEMS, 3);
assert.equal(FREE_COMMUNITY_RECIPE_ITEMS, 1);
assert.equal(getRecipeGenerationCost("single"), 1);
assert.equal(getRecipeGenerationCost("set"), 3);
assert.equal(getLocalDateKey(monday), "2026-09-07");

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

assert.deepEqual(normalizeDailyFeatureUsage({ date: "2026-09-07", count: 2 }, monday), {
  date: "2026-09-07",
  count: 2,
});
assert.deepEqual(normalizeDailyFeatureUsage({ date: "2026-09-07", count: 2 }, nextMonday), {
  date: "2026-09-14",
  count: 0,
});

assert.equal(await verifyPremiumTestPassword("Hello Sikurepi"), true);
assert.equal(await verifyPremiumTestPassword("hello sikurepi"), false);
assert.equal(await verifyPremiumTestPassword("Hello Sikurepi "), false);

console.log("Premium weekly quota: all tests passed.");
