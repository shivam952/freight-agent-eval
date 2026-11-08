// Deterministic checks: compare an agent's answer sheet with the expected answer.
// No AI involved here — the ruler must not move.

import type { AgentOutput, Expected } from "./types.js";

export interface CheckResult {
  box: string; // which output field was checked
  pass: boolean;
  expected: string;
  got: string;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function runChecks(out: AgentOutput, exp: Expected): CheckResult[] {
  const results: CheckResult[] = [
    {
      box: "customer",
      pass: exp.customer_one_of.some((name) => norm(out.customer).includes(norm(name))),
      expected: `contains one of ${exp.customer_one_of.map((n) => `"${n}"`).join("/")}`,
      got: out.customer,
    },
    {
      box: "customer_role",
      pass: out.customer_role === exp.customer_role,
      expected: exp.customer_role,
      got: out.customer_role,
    },
    {
      box: "incoterm",
      pass: norm(out.incoterm) === norm(exp.incoterm),
      expected: exp.incoterm,
      got: out.incoterm,
    },
    {
      // Exact match: an extra leg over-charges (lost deal), a missing leg leaks profit.
      box: "legs_quoted",
      pass: sameSet(out.legs_quoted ?? [], exp.legs_quoted),
      expected: exp.legs_quoted.join(","),
      got: (out.legs_quoted ?? []).join(","),
    },
    {
      box: "insurance_included",
      pass: out.insurance_included === exp.insurance_included,
      expected: String(exp.insurance_included),
      got: String(out.insurance_included),
    },
    {
      box: "port_of_discharge",
      pass: exp.port_of_discharge_one_of.map(norm).includes(norm(out.port_of_discharge) || "NONE"),
      expected: `one of ${exp.port_of_discharge_one_of.join("/")}`,
      got: String(out.port_of_discharge),
    },
    {
      box: "dangerous_goods",
      pass: out.dangerous_goods === exp.dangerous_goods,
      expected: String(exp.dangerous_goods),
      got: String(out.dangerous_goods),
    },
    {
      box: "action",
      pass: exp.action_one_of.includes(out.action),
      expected: `one of ${exp.action_one_of.join("/")}`,
      got: out.action,
    },
  ];
  results.push({
    box: "deadline_risk",
    pass: exp.deadline_risk_one_of.includes(out.deadline_risk),
    expected: `one of ${exp.deadline_risk_one_of.join("/")}`,
    got: out.deadline_risk,
  });
  const asked = out.requested_info ?? [];
  const missing = exp.requested_info.filter((group) => !group.some((item) => asked.includes(item)));
  results.push({
    // Empty expectation = the agent must not ask anything (unnecessary questions delay the quote).
    box: "requested_info",
    pass: exp.requested_info.length === 0 ? asked.length === 0 : missing.length === 0,
    expected: exp.requested_info.length === 0 ? "nothing" : exp.requested_info.map((g) => g.join("|")).join(" AND "),
    got: asked.length === 0 ? "nothing" : asked.join(","),
  });
  return results;
}
