// Regression report: compare two saved runs case by case.
// Usage: npm run report -- <base-run.json> <new-run.json> [--out report.md] [--gate]
// --gate exits with code 1 if the new run has a regression (a case that passed in the base
// run now fails) or any easy case fails. Used by CI to block merging.

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
  output?: { trace?: { interventions: string[] } };
}
interface Run {
  agent: string;
  at: string;
  results: CaseResult[];
}

const args = process.argv.slice(2);
const gate = args.includes("--gate");
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
const [baseFile, newFile] = positional;
if (!baseFile || !newFile) {
  console.error("Usage: npm run report -- <base-run.json> <new-run.json> [--out report.md] [--gate]");
  process.exit(2);
}
const base: Run = JSON.parse(readFileSync(baseFile, "utf8"));
const next: Run = JSON.parse(readFileSync(newFile, "utf8"));

const passed = (r?: CaseResult) => !!r && !r.error && r.checks.length > 0 && r.checks.every((c) => c.pass);
const byId = (run: Run) => new Map(run.results.map((r) => [r.id, r]));
const b = byId(base);
const n = byId(next);
// Only cases present in BOTH runs are compared; a case that wasn't run hasn't failed.
const ids = [...b.keys()].filter((id) => n.has(id)).sort();
const notCompared = [...new Set([...b.keys(), ...n.keys()])].filter((id) => !(b.has(id) && n.has(id))).sort();

const score = (run: Run, filter: (r: CaseResult) => boolean) => {
  const rs = run.results.filter((r) => ids.includes(r.id)).filter(filter);
  return `${rs.filter(passed).length}/${rs.length}`;
};
const eur = (run: Run) => run.results.filter((r) => ids.includes(r.id)).reduce((s, r) => s + eurAtRisk(r.checks), 0);
const fmtEur = (x: number) => `€${x.toLocaleString("en-US")}`;
const failedBoxes = (r?: CaseResult) =>
  r?.error ? "error" : (r?.checks ?? []).filter((c) => !c.pass).map((c) => `${c.box} (expected ${c.expected}, got ${c.got})`).join("; ");

const regressions = ids.filter((id) => passed(b.get(id)) && !passed(n.get(id)));
const fixes = ids.filter((id) => !passed(b.get(id)) && passed(n.get(id)));
const stillFailing = ids.filter((id) => !passed(b.get(id)) && !passed(n.get(id)));
const easyFailing = next.results.filter((r) => ids.includes(r.id) && !r.trap && !passed(r)).map((r) => r.id);

const lines: string[] = [];
lines.push(`# Regression report`, ``);
lines.push(`- **Base:** \`${base.agent}\` (${base.at})`);
lines.push(`- **New:** \`${next.agent}\` (${next.at})`);
lines.push(`- **Compared:** ${ids.length} cases${notCompared.length ? ` (not in both runs: ${notCompared.join(", ")})` : ""}`, ``);
lines.push(`| | Base | New |`, `|---|---|---|`);
lines.push(`| Dev cases passed | ${score(base, (r) => r.split === "dev")} | ${score(next, (r) => r.split === "dev")} |`);
lines.push(`| Easy cases passed | ${score(base, (r) => !r.trap)} | ${score(next, (r) => !r.trap)} |`);
lines.push(`| Holdout cases passed | ${score(base, (r) => r.split === "holdout")} | ${score(next, (r) => r.split === "holdout")} |`);
lines.push(`| € at risk (illustrative) | ${fmtEur(eur(base))} | ${fmtEur(eur(next))} |`, ``);

lines.push(`## Regressions (passed before, fail now): ${regressions.length}`, ``);
for (const id of regressions) lines.push(`- **${id}**: ${failedBoxes(n.get(id))} — ${fmtEur(eurAtRisk(n.get(id)?.checks ?? []))} at risk`);
lines.push(``, `## Fixed (failed before, pass now): ${fixes.length}`, ``);
for (const id of fixes) lines.push(`- ${id}`);
lines.push(``, `## Still failing: ${stillFailing.length}`, ``);
for (const id of stillFailing) lines.push(`- ${id}: ${failedBoxes(n.get(id))} — ${fmtEur(eurAtRisk(n.get(id)?.checks ?? []))} at risk`);

const interventions = next.results.flatMap((r) => (r.output?.trace?.interventions ?? []).map((i) => `${r.id}: ${i}`));
if (interventions.length) {
  lines.push(``, `## Guardrail interventions in the new run: ${interventions.length}`, ``);
  for (const i of interventions) lines.push(`- ${i}`);
}

const verdict = ids.length > 0 && regressions.length === 0 && easyFailing.length === 0;
lines.push(``, `## Verdict: ${verdict ? "✅ safe to ship" : "❌ do not ship"}`);
if (!verdict) {
  if (regressions.length) lines.push(`- ${regressions.length} regression(s): ${regressions.join(", ")}`);
  if (easyFailing.length) lines.push(`- easy case(s) failing: ${easyFailing.join(", ")}`);
}

const md = lines.join("\n") + "\n";
console.log(md);
if (outFile) writeFileSync(outFile, md);
if (gate && !verdict) process.exit(1);
