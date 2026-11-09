# freight-agent-eval

**An evaluation harness for AI agents that answer freight-forwarding emails — built to catch what silently breaks when the agent changes.**

AI agents that handle forwarders' inboxes change constantly: new prompts, new models, new code. Every change can quietly break correct handling of a tricky email — a misread Incoterm, an inland city used as a seaport, lithium batteries quoted as ordinary cargo. Usually the forwarder's operations team finds out first. This harness finds out before that: it runs an agent against realistic freight test cases, checks every answer against hand-reviewed ground truth, and reports what broke between versions and what it would cost.

## What it found (the short version)

| Agent version | What changed | Dev cases | Easy cases | Held-out cases |
|---|---|---|---|---|
| v0 | One LLM call, no tools | 1/10 | 0/4 | 1/5 |
| v1 | + Incoterm rules tool | 6/10 | 4/4 | 2/5 |
| v2 | + guardrails in code | 7/10 | 4/4 | 2/5 |
| v3 | + seaport lookup | 8/10 | **3/4** (regression) | 2/5 |
| v4 | + grounded role step | 9/10 | 4/4 | 2/5 |
| v5 | + date/transit tool | **10/10** | **4/4** | **4/5** |

*Model: `google/gemini-2.5-flash-lite` via OpenRouter, temperature 0, 3 runs per version (identical results unless noted). Illustrative € at risk across all 15 cases: €17,550 (v0) → €5,500 (v5). See [`reports/v0-vs-v5.md`](reports/v0-vs-v5.md).*

Things the harness caught along the way:

1. **A one-line prompt change silently broke an easy case.** Adding "or UNKNOWN if the email doesn't say" to the Incoterm instruction made the agent call an FOB buyer the *seller* and quote the wrong legs. Reverting the line restored it (confirmed twice). The overall score barely moved.
2. **Adding one output field made the agent quote lithium-battery cargo as normal goods** — the most expensive failure in the set, introduced by a change to the answer format.
3. **A keyword check gave a false pass**: the reply "mentioned" pallets only because it echoed the customer's own words. Replaced with a structured field.
4. **A guardrail spread an upstream error**: the model asked for a safety data sheet for ceramic kitchenware, and the "don't quote while asking questions" guardrail dutifully blocked a valid quote.
5. **Adding the seaport tool re-broke an easy case** through buyer/seller confusion — fixed by a separate role step whose evidence must be quoted verbatim from the email.
6. **The one held-out failure is structural**: power banks *are* lithium batteries, the email never says so, the model doesn't notice — and guardrails can't catch what the model never flags. See [`reports/example-regression-v4-to-v3.md`](reports/example-regression-v4-to-v3.md) for what a blocked release looks like.

## How it works

| Part | File | Role |
|---|---|---|
| Test cases | [`cases/`](cases/) | 15 hand-reviewed emails (4 easy, 11 traps) with expected answers and the reasoning behind them. 5 were held out while building the agent. |
| The plug | [`src/types.ts`](src/types.ts) | A fixed answer sheet every agent must return: customer, role, Incoterm, legs quoted, insurance, port of discharge, dangerous goods, action, deadline risk, requested info, reply. Any agent that returns it can be tested. |
| Checks | [`src/checks.ts`](src/checks.ts) | Deterministic comparisons with the expected answer — no LLM grading. Self-tested: a correct answer passes, a known-wrong one fails exactly one check. |
| Reference agent | [`src/agentV5.ts`](src/agentV5.ts) | Deliberately simple exam candidate: a cheap model plus three deterministic tools (Incoterm rules, seaport lookup, transit/deadline arithmetic), a grounded role step and guardrails. Earlier versions are kept so their results stay reproducible. |
| Report & gate | [`src/report.ts`](src/report.ts) | Compares two runs case by case: regressions, fixes, guardrail interventions, € at risk. `--gate` fails if anything regresses or an easy case fails. |
| CI | [`.github/workflows/eval.yml`](.github/workflows/eval.yml) | Unit tests on every push and pull request; the full evaluation + gate when an `OPENROUTER_API_KEY` secret is set. |

### Principles behind the design

- **The ruler must not move.** Correct answers are written and reviewed before any run. An LLM is never asked at test time what the right answer is.
- **Rules in code, judgment in the model.** Incoterm legs, which places are seaports and date arithmetic are deterministic tools; reading a messy email is the model's job.
- **Verify the judgment's evidence.** The buyer/seller decision must quote the email word for word; code checks the quote exists, otherwise the agent asks instead of guessing.
- **Score the model and the system separately.** With guardrails in place, the harness also scores the raw model answer and counts how often guardrails had to intervene — otherwise a worse model hides behind the guardrails.
- **When a test fails, decide whether the agent or the ruler is wrong** — on domain logic, never to make results green. Every ruler change is recorded with its reason in the commit history.
- **Freeze the volatile world.** "Today" and transit times are fixed inputs, so a test can't fail because the calendar moved.
- **Held-out cases are used once.** They were revealed only after the last tool was built; they are now spent, and future changes need fresh ones.

## Run it

```bash
npm install
npm test                                   # unit tests: tools, checks, guardrails
OPENROUTER_API_KEY=... npm run eval -- --agent v5            # run the agent (holdout details hidden)
npm run report -- baselines/v5.json runs/latest.json --gate  # compare with the baseline
```

`--agent v0` … `v5` selects a version; add a model id (e.g. `anthropic/claude-haiku-4.5`) or case ids (`TC-003`) to narrow a run.

## Limitations (honest ones)

- **Synthetic data.** The emails are realistic in style but written for this project, not taken from a real inbox, and not yet reviewed by a practitioner.
- **Small.** 15 cases, one workflow (quote requests), one cheap model, North-European destinations only.
- **€ figures are illustrative assumptions** ([`src/costs.ts`](src/costs.ts)), useful for ranking failures, not as measured losses.
- **Domain rules are simplified** (e.g. FCA is treated as "ask for the named place"; transit times are a fixed range). Check against the ICC Incoterms rules and current schedules before relying on them.
- **Guardrails don't rewrite the reply email**, so a corrected answer sheet can still come with a reply that reads like a quote.
- **Temperature 0 isn't determinism.** Results were stable across 3 runs per version, but CI runs each case once.

## Next

- Compare models: a cheap model with tools vs a strong model without them.
- Grow to ~40 cases with generated variations of each trap, and a fresh held-out set.
- A narrow LLM judge (evaluated against hand labels) for what can't be checked deterministically, such as whether the reply text matches the answer sheet.
