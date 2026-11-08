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
      pass: norm(out.customer).includes(norm(exp.customer_contains)),
      expected: `contains "${exp.customer_contains}"`,
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
      pass: exp.port_of_discharge_one_of.map(norm).includes(norm(out.port_of_discharge)),
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
  if (exp.reply_must_mention) {
    const reply = (out.reply_email ?? "").toLowerCase();
    const missing = exp.reply_must_mention.filter((group) => !group.some((w) => reply.includes(w.toLowerCase())));
    results.push({
      box: "reply_mentions",
      pass: missing.length === 0,
      expected: exp.reply_must_mention.map((g) => g.join("|")).join(" AND "),
      got: missing.length === 0 ? "all mentioned" : `missing: ${missing.map((g) => g.join("|")).join(", ")}`,
    });
  }
  return results;
}
