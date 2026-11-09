// Expected dates worked out by hand: Jan 1 2026 is a Thursday, so ISO week 1 starts Mon 29 Dec 2025.

import assert from "node:assert/strict";
import { test } from "node:test";
import { deadlineCheck, isoWeekRange } from "./dates.js";

const d = (x: Date) => x.toISOString().slice(0, 10);

test("ISO weeks: KW46 2026 = 9-15 Nov, KW49 = 30 Nov - 6 Dec", () => {
  assert.deepEqual(isoWeekRange(2026, 46).map(d), ["2026-11-09", "2026-11-15"]);
  assert.deepEqual(isoWeekRange(2026, 49).map(d), ["2026-11-30", "2026-12-06"]);
  assert.deepEqual(isoWeekRange(2026, 1).map(d), ["2025-12-29", "2026-01-04"]);
});

test("impossible: ready 20 Nov, must arrive 1 Dec", () => {
  assert.equal(deadlineCheck("2026-11-20", "2026-12-01", true).risk, "impossible");
});

test("at risk: ready week 46, deadline 24 Dec, inland destination", () => {
  // earliest 9 Nov + 37 = 16 Dec (before), latest 15 Nov + 55 = 9 Jan (after)
  const r = deadlineCheck("2026-W46", "2026-12-24", true);
  assert.equal(r.risk, "at_risk");
  assert.deepEqual(r.arrival_window, ["2026-12-16", "2027-01-09"]);
});

test("none: ready week 49, deadline end of February", () => {
  assert.equal(deadlineCheck("2026-W49", "2027-02-28", false).risk, "none");
});

test("no deadline -> none; no ready date -> flagged", () => {
  assert.deepEqual([deadlineCheck("2026-11-23", "", false).risk, deadlineCheck("2026-11-23", "", false).note], ["none", "no_deadline"]);
  assert.equal(deadlineCheck("", "2026-12-24", false).note, "unknown_ready_date");
});

test("garbage input is flagged, not guessed", () => {
  assert.equal(deadlineCheck("soon", "", false).note, "unparseable");
});
