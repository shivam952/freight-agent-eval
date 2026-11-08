// Runner: load every test case, send it through the plug to an agent,
// check the answer sheet, print results and save the full run for later comparison.
//
// Usage: npx tsx src/run.ts [model] [case-id ...]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeReferenceAgent } from "./agent.js";
import { runChecks, type CheckResult } from "./checks.js";
import type { AgentOutput, TestCase } from "./types.js";

const model = process.argv[2] ?? "google/gemini-2.5-flash-lite";
const only = process.argv.slice(3);

const cases: TestCase[] = readdirSync("cases")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(`cases/${f}`, "utf8")))
  .filter((tc: TestCase) => only.length === 0 || only.includes(tc.id));

const agent = makeReferenceAgent(model);
const results: { id: string; trap: boolean; output?: AgentOutput; checks: CheckResult[]; error?: string }[] = [];

console.log(`Agent: ${agent.name}\n`);
for (const tc of cases) {
  try {
    const output = await agent.run(tc.email);
    const checks = runChecks(output, tc.expected);
    results.push({ id: tc.id, trap: tc.trap, output, checks });
    const failed = checks.filter((c) => !c.pass);
    const label = failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${checks.length} checks)`;
    console.log(`${tc.id} ${tc.trap ? "[trap]" : "[easy]"} ${label}  ${tc.title}`);
    for (const c of failed) console.log(`    ✗ ${c.box}: expected ${c.expected}, got ${c.got}`);
  } catch (e) {
    results.push({ id: tc.id, trap: tc.trap, checks: [], error: String(e) });
    console.log(`${tc.id} ERROR ${String(e).slice(0, 200)}`);
  }
}

const passed = results.filter((r) => r.checks.length > 0 && r.checks.every((c) => c.pass)).length;
console.log(`\n${passed}/${results.length} cases passed`);

mkdirSync("runs", { recursive: true });
const file = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}_${model.replace(/\//g, "_")}.json`;
writeFileSync(file, JSON.stringify({ agent: agent.name, model, at: new Date().toISOString(), results }, null, 2));
console.log(`Saved ${file}`);
