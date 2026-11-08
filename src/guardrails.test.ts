import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGuardrails } from "./guardrails.js";
import { incotermScope } from "./tools/incoterms.js";
import type { AgentOutput } from "./types.js";

const base: AgentOutput = {
  customer: "X", customer_role: "buyer", incoterm: "FOB", legs_quoted: [3, 4, 5], insurance_included: false,
  port_of_discharge: "DEHAM", dangerous_goods: false, action: "quote", deadline_risk: "none",
  requested_info: [], reply_email: "",
};

test("a consistent answer is left untouched", () => {
  const r = applyGuardrails(base, incotermScope("FOB", "buyer"));
  assert.deepEqual(r.interventions, []);
  assert.deepEqual(r.output, base);
});

test("legs are forced to the tool's legs (TC-010 pattern)", () => {
  const r = applyGuardrails({ ...base, legs_quoted: [1, 2, 3, 4, 5] }, incotermScope("FOB", "buyer"));
  assert.deepEqual(r.output.legs_quoted, [3, 4, 5]);
  assert.equal(r.interventions.length, 1);
});

test("dangerous goods can't be quoted directly (TC-001 pattern)", () => {
  const r = applyGuardrails({ ...base, dangerous_goods: true }, incotermScope("FOB", "buyer"));
  assert.equal(r.output.action, "ask");
  assert.ok(r.output.requested_info.includes("sds") && r.output.requested_info.includes("un_number"));
});

test("escalate is kept when it is already safe", () => {
  const r = applyGuardrails({ ...base, dangerous_goods: true, action: "escalate" }, incotermScope("FOB", "buyer"));
  assert.equal(r.output.action, "escalate");
});

test("open questions turn a quote into ask (TC-006 pattern)", () => {
  const r = applyGuardrails({ ...base, requested_info: ["weight"] }, incotermScope("FOB", "buyer"));
  assert.equal(r.output.action, "ask");
});

test("seller under EXW: nothing quoted, no port, ask for counterparty (TC-008 pattern)", () => {
  const r = applyGuardrails({ ...base, customer_role: "seller", incoterm: "EXW", legs_quoted: [1, 2, 3, 4, 5] }, incotermScope("EXW", "seller"));
  assert.deepEqual(r.output.legs_quoted, []);
  assert.equal(r.output.port_of_discharge, null);
  assert.equal(r.output.action, "ask");
  assert.ok(r.output.requested_info.includes("counterparty_contact"));
});

test("guardrails can't catch dangerous goods the model missed (known limit)", () => {
  const r = applyGuardrails(base, incotermScope("FOB", "buyer")); // power banks, dangerous_goods=false
  assert.equal(r.output.action, "quote");
});
