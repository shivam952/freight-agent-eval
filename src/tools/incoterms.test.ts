// Unit tests for the Incoterm rules tool. Expected values are the Lesson 2 table,
// written by hand, not derived from the code under test.

import assert from "node:assert/strict";
import { test } from "node:test";
import { incotermScope } from "./incoterms.js";

test("FOB: seller 1-2, buyer 3-5, no insurance", () => {
  assert.deepEqual(incotermScope("FOB", "seller"), { legs: [1, 2], insurance: false, note: "ok" });
  assert.deepEqual(incotermScope("FOB", "buyer"), { legs: [3, 4, 5], insurance: false, note: "ok" });
});

test("CIF: seller 1-3 with insurance, buyer 4-5 without", () => {
  assert.deepEqual(incotermScope("CIF", "seller"), { legs: [1, 2, 3], insurance: true, note: "ok" });
  assert.deepEqual(incotermScope("CIF", "buyer"), { legs: [4, 5], insurance: false, note: "ok" });
});

test("DAP: seller 1,2,3,5 (import customs stays with buyer)", () => {
  assert.deepEqual(incotermScope("DAP", "seller").legs, [1, 2, 3, 5]);
  assert.deepEqual(incotermScope("DAP", "buyer").legs, [4]);
});

test("DDP: seller all 5, no insurance obligation", () => {
  assert.deepEqual(incotermScope("DDP", "seller"), { legs: [1, 2, 3, 4, 5], insurance: false, note: "ok" });
});

test("EXW: buyer all 5; seller owns nothing (TC-008)", () => {
  assert.deepEqual(incotermScope("EXW", "buyer").legs, [1, 2, 3, 4, 5]);
  assert.deepEqual(incotermScope("EXW", "seller"), { legs: [], insurance: false, note: "asker_owns_no_legs" });
});

test("no or unknown Incoterm: no legs, ask (TC-007)", () => {
  assert.equal(incotermScope("UNKNOWN", "buyer").note, "unknown_incoterm");
  assert.equal(incotermScope("", "buyer").note, "unknown_incoterm");
  assert.deepEqual(incotermScope("XYZ", "seller").legs, []);
});

test("input is normalised: ' fob ' works like 'FOB'", () => {
  assert.deepEqual(incotermScope(" fob ", "buyer").legs, [3, 4, 5]);
});

test("FCA depends on the named place: ask", () => {
  assert.equal(incotermScope("FCA", "buyer").note, "named_place_needed");
});
