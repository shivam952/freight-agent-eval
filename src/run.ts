// Runner: load every test case, send it through the plug to an agent,
// check the answer sheet, print results and save the full run for later comparison.
//
// Usage: npx tsx src/run.ts [model] [case-id ...]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeReferenceAgent } from "./agent.js";
import { runChecks, type CheckResult } from "./checks.js";
import type { AgentOutput, TestCase } from "./types.js";

const args = process.argv.slice(2);
const showHoldout = args.includes("--show-holdout");
const rest = args.filter((a) => a !== "--show-holdout");
const model = rest[0] ?? "google/gemini-2.5-flash-lite";
const only = rest.slice(1);

const cases: TestCase[] = readdirSync("cases")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(`cases/${f}`, "utf8")))
  .filter((tc: TestCase) => only.length === 0 || only.includes(tc.id));

const agent = makeReferenceAgent(model);
const results: { id: string; trap: boolean; split: string; output?: AgentOutput; checks: CheckResult[]; error?: string }[] = [];

console.log(`Agent: ${agent.name}\n`);
for (const tc of cases) {
  try {
    const output = await agent.run(tc.email);
    const checks = runChecks(output, tc.expected);
    results.push({ id: tc.id, trap: tc.trap, split: tc.split, output, checks });
    if (tc.split === "holdout" && !showHoldout) continue; // details hidden: see the summary line
    const failed = checks.filter((c) => !c.pass);
    const label = failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${checks.length} checks)`;
    console.log(`${tc.id} ${tc.trap ? "[trap]" : "[easy]"} ${label}  ${tc.title}`);
    for (const c of failed) console.log(`    ✗ ${c.box}: expected ${c.expected}, got ${c.got}`);
  } catch (e) {
    results.push({ id: tc.id, trap: tc.trap, split: tc.split, checks: [], error: String(e) });
    console.log(`${tc.id} ERROR ${String(e).slice(0, 200)}`);
  }
}

const ok = (r: (typeof results)[number]) => r.checks.length > 0 && r.checks.every((c) => c.pass);
const summary = (split: string) => {
  const rs = results.filter((r) => r.split === split);
  return `${rs.filter(ok).length}/${rs.length}`;
};
const easy = results.filter((r) => !r.trap);
console.log(`\nDev: ${summary("dev")} cases passed (easy: ${easy.filter(ok).length}/${easy.length})`);
console.log(`Holdout: ${summary("holdout")} cases passed${showHoldout ? "" : " (details hidden; --show-holdout to reveal)"}`);

mkdirSync("runs", { recursive: true });
const file = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}_${model.replace(/\//g, "_")}.json`;
writeFileSync(file, JSON.stringify({ agent: agent.name, model, at: new Date().toISOString(), results }, null, 2));
console.log(`Saved ${file}`);
