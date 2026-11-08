// Runner: load every test case, send it through the plug to an agent,
// check the answer sheet, print results and save the full run for later comparison.
//
// Usage: npm run eval -- [--agent v0|v1|v2] [--show-holdout] [model] [case-id ...]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeReferenceAgent } from "./agent.js";
import { makeReferenceAgentV1 } from "./agentV1.js";
import { makeReferenceAgentV2 } from "./agentV2.js";
import { runChecks, type CheckResult } from "./checks.js";
import type { AgentOutput, TestCase } from "./types.js";

const args = process.argv.slice(2);
const showHoldout = args.includes("--show-holdout");
const agentFlag = args.indexOf("--agent");
const agentVersion = agentFlag >= 0 ? args[agentFlag + 1] : "v0";
const rest = args.filter((a, i) => a !== "--show-holdout" && i !== agentFlag && i !== agentFlag + 1);
const model = rest[0] ?? "google/gemini-2.5-flash-lite";
const only = rest.slice(1);

const cases: TestCase[] = readdirSync("cases")
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(`cases/${f}`, "utf8")))
  .filter((tc: TestCase) => only.length === 0 || only.includes(tc.id));

const agent =
  agentVersion === "v2" ? makeReferenceAgentV2(model) : agentVersion === "v1" ? makeReferenceAgentV1(model) : makeReferenceAgent(model);
type Result = {
  id: string; trap: boolean; split: string; output?: AgentOutput; checks: CheckResult[];
  rawChecks?: CheckResult[]; // the model's own answer, before guardrails (v2 only)
  error?: string;
};
const results: Result[] = [];

console.log(`Agent: ${agent.name}\n`);
for (const tc of cases) {
  try {
    const output = await agent.run(tc.email);
    const checks = runChecks(output, tc.expected);
    const rawChecks = output.trace ? runChecks(output.trace.raw, tc.expected) : undefined;
    results.push({ id: tc.id, trap: tc.trap, split: tc.split, output, checks, rawChecks });
    if (tc.split === "holdout" && !showHoldout) continue; // details hidden: see the summary line
    const failed = checks.filter((c) => !c.pass);
    const label = failed.length === 0 ? "PASS" : `FAIL (${failed.length}/${checks.length} checks)`;
    console.log(`${tc.id} ${tc.trap ? "[trap]" : "[easy]"} ${label}  ${tc.title}`);
    for (const c of failed) console.log(`    ✗ ${c.box}: expected ${c.expected}, got ${c.got}`);
    for (const i of output.trace?.interventions ?? []) console.log(`    ⚙ guardrail: ${i}`);
  } catch (e) {
    results.push({ id: tc.id, trap: tc.trap, split: tc.split, checks: [], error: String(e) });
    if (tc.split === "holdout" && !showHoldout) continue;
    console.log(`${tc.id} ERROR ${String(e).slice(0, 200)}`);
  }
}

const ok = (r: Result) => r.checks.length > 0 && r.checks.every((c) => c.pass);
const rawOk = (r: Result) => (r.rawChecks ?? []).length > 0 && r.rawChecks!.every((c) => c.pass);
const summary = (split: string) => {
  const rs = results.filter((r) => r.split === split);
  const base = `${rs.filter(ok).length}/${rs.length}`;
  return rs.some((r) => r.rawChecks) ? `${base} (model alone: ${rs.filter(rawOk).length}/${rs.length})` : base;
};
const easy = results.filter((r) => !r.trap);
console.log(`\nDev: ${summary("dev")} cases passed (easy: ${easy.filter(ok).length}/${easy.length})`);
console.log(`Holdout: ${summary("holdout")} cases passed${showHoldout ? "" : " (details hidden; --show-holdout to reveal)"}`);
const corrected = results.filter((r) => (r.output?.trace?.interventions.length ?? 0) > 0).length;
if (results.some((r) => r.output?.trace)) console.log(`Guardrails corrected the model in ${corrected}/${results.length} cases`);

mkdirSync("runs", { recursive: true });
const file = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}_${agentVersion}_${model.replace(/\//g, "_")}.json`;
writeFileSync(file, JSON.stringify({ agent: agent.name, model, at: new Date().toISOString(), results }, null, 2));
console.log(`Saved ${file}`);
