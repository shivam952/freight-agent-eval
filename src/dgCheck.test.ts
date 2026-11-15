import assert from "node:assert/strict";
import { test } from "node:test";
import { combineDangerousGoods, type DgCheck } from "./dgCheck.js";

const check = (verdict: DgCheck["verdict"], grounded = true): DgCheck => ({ verdict, evidence: "power banks", grounded, reason: "" });

test("a grounded 'yes' overrides an agent that missed dangerous goods (TC-015 pattern)", () => {
  assert.deepEqual(combineDangerousGoods(false, check("yes")), { dg: true, overridden: true });
});

test("the check never removes dangerous goods the agent found", () => {
  assert.deepEqual(combineDangerousGoods(true, check("no")), { dg: true, overridden: false });
});

test("an ungrounded 'yes' (evidence not in the email) is ignored", () => {
  assert.deepEqual(combineDangerousGoods(false, check("yes", false)), { dg: false, overridden: false });
});

test("'unsure' does not override (avoids false alarms on ordinary cargo)", () => {
  assert.deepEqual(combineDangerousGoods(false, check("unsure")), { dg: false, overridden: false });
});
