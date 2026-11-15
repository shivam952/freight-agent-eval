// Model comparison: one row per saved run (agent version x model), same 15 test cases.
// Usage: npm run compare -- runs/a.json runs/b.json ... [--out reports/model-comparison.md]

import { readFileSync, writeFileSync } from "node:fs";
import type { CheckResult } from "./checks.js";
import { eurAtRisk } from "./costs.js";

interface CaseResult {
  id: string;
  trap: boolean;
  split: string;
  checks: CheckResult[];
  rawChecks?: CheckResult[];
  error?: string;
  usage?: { cost_usd: number };
  ms?: number;
}
interface Run {
  agent: string;
  model: string;
  results: CaseResult[];
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined;
const files = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));

const ok = (cs?: CheckResult[], err?: string) => !err && !!cs && cs.length > 0 && cs.every((c) => c.pass);
const frac = (rs: CaseResult[], f: (r: CaseResult) => boolean) => `${rs.filter(f).length}/${rs.length}`;

const rows = files.map((f) => {
  const run: Run = JSON.parse(readFileSync(f, "utf8"));
  const rs = run.results;
  const version = run.agent.split("/")[0].replace("reference-", "");
  const n = Math.max(rs.length, 1);
  const cost = rs.reduce((s, r) => s + (r.usage?.cost_usd ?? 0), 0);
  const hasCost = rs.some((r) => r.usage);
  const hasRaw = rs.some((r) => r.rawChecks);
  return {
    sortKey: `${version}-${cost}`,
    cells: [
      version,
      run.model,
      frac(rs, (r) => ok(r.checks, r.error)),
      frac(rs.filter((r) => !r.trap), (r) => ok(r.checks, r.error)),
      frac(rs.filter((r) => r.trap), (r) => ok(r.checks, r.error)),
      hasRaw ? frac(rs, (r) => ok(r.rawChecks, r.error)) : "–",
      `€${rs.reduce((s, r) => s + eurAtRisk(r.checks), 0).toLocaleString("en-US")}`,
      hasCost ? `$${((cost / n) * 1000).toFixed(2)}` : "–",
      rs.some((r) => r.ms) ? `${(rs.reduce((s, r) => s + (r.ms ?? 0), 0) / n / 1000).toFixed(1)} s` : "–",
      rs.filter((r) => r.error).length ? `${rs.filter((r) => r.error).length} errors` : "",
    ],
  };
});
rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));

const header = ["Agent", "Model", "All 15", "Easy", "Traps", "Model alone", "€ at risk", "Cost / 1,000 emails", "Time / email", "Notes"];
const md = [
  `| ${header.join(" | ")} |`,
  `|${header.map(() => "---").join("|")}|`,
  ...rows.map((r) => `| ${r.cells.join(" | ")} |`),
].join("\n");
console.log(md);
if (outFile) writeFileSync(outFile, md + "\n");
