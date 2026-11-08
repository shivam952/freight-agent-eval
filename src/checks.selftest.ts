// Testing the tester: before trusting the checks, prove they pass a correct answer
// and fail a known-wrong one.

import { readFileSync } from "node:fs";
import { runChecks } from "./checks.js";
import type { AgentOutput, TestCase } from "./types.js";

const tc: TestCase = JSON.parse(readFileSync("cases/TC-002.json", "utf8"));

const perfect: AgentOutput = {
  customer: "Anna Schulz, Nordhaus Interiors GmbH",
  customer_role: "buyer",
  incoterm: "fob", // lower case on purpose: should still pass
  legs_quoted: [5, 3, 4], // different order on purpose: should still pass
  insurance_included: false,
  port_of_discharge: "deham",
  dangerous_goods: false,
  action: "quote",
  reply_email: "...",
};

// Same as perfect, but quotes export customs (leg 2), which the seller owns under FOB.
const extraLeg: AgentOutput = { ...perfect, legs_quoted: [2, 3, 4, 5] };

let ok = true;
const failed = (out: AgentOutput) => runChecks(out, tc.expected).filter((r) => !r.pass);

const f1 = failed(perfect);
console.log(f1.length === 0 ? "PASS perfect answer passes all checks" : `FAIL perfect answer failed: ${f1.map((r) => r.box)}`);
ok &&= f1.length === 0;

const f2 = failed(extraLeg);
const onlyLegs = f2.length === 1 && f2[0].box === "legs_quoted";
console.log(onlyLegs ? "PASS extra leg 2 fails exactly the legs check" : `FAIL unexpected: ${f2.map((r) => r.box)}`);
ok &&= onlyLegs;

process.exit(ok ? 0 : 1);
