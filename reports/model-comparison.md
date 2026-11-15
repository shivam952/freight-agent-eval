# Model comparison: cheap model + tools vs strong models (2026-11-15)

Same 15 test cases, one run per configuration. v0 = one LLM call, no tools. v5 = grounded role step, Incoterm / seaport / date tools, guardrails. "Model alone" = the model's own answer before guardrails. € at risk uses the illustrative costs in [`src/costs.ts`](../src/costs.ts). Cost and time are measured from OpenRouter usage data.

| Agent | Model | All 15 | Easy | Traps | Model alone | € at risk | Cost / 1,000 emails | Time / email |
|---|---|---|---|---|---|---|---|---|
| v0 | google/gemini-2.5-flash-lite | 2/15 | 0/4 | 2/11 | – | €17,150 | $0.14 | 0.9 s |
| v0 | openai/gpt-5-mini | 3/15 | 1/4 | 2/11 | – | €8,000 | $4.63 | 23.0 s |
| v0 | google/gemini-3.1-pro-preview | 9/15 | 4/4 | 5/11 | – | €2,600 | $20.86 | 16.6 s |
| v0 | anthropic/claude-sonnet-5.5 | 11/15 | 4/4 | 7/11 | – | €2,200 | $14.27 | 9.4 s |
| v5 | openai/gpt-5-mini | 9/15 | 1/4 | 8/11 | 5/15 | €3,000 | $11.11 | 60.6 s |
| v5 | anthropic/claude-sonnet-5.5 | 12/15 | 4/4 | 8/11 | 11/15 | **€700** | $27.94 | 16.9 s |
| **v5** | **google/gemini-2.5-flash-lite** | **14/15** | **4/4** | **10/11** | 10/15 | €5,500 | **$0.51** | **2.9 s** |

(v5 on Gemini 3.1 Pro was stopped to save credit.)

## Findings

1. **Tools beat model size on pass rate and cost.** The cheapest model with tools passes 14/15 at $0.51 per 1,000 emails. The best model without tools passes 11/15 at $14.27: 28× the cost for fewer correct answers.
2. **Pass rate and business risk rank differently.** The cheap model's one failure is the most expensive kind: power banks quoted as normal cargo (hidden dangerous goods, €5,000 of its €5,500). Claude Sonnet 5.5 with the same tools passes fewer cases (12/15) but carries the lowest risk (€700): it catches the power banks, and its misses are minor (an unasked question). **Counting passed cases alone would pick the riskier agent.**
3. **The strong models catch what tools can't.** Every strong model, with or without tools, flagged the power banks; the cheap model never did. That's world knowledge, not a rule a tool can encode.
4. **More expensive isn't uniformly better.** GPT-5 mini (mid-priced) does worse than the cheapest model in both setups and is the slowest (60 s per email with tools). Most of its failures are asking customers unnecessary questions on easy cases, which delays quotes.
5. **Integration differs per model.** Claude Sonnet 5.5 rejects forced tool calls; v5 needed a fallback. GPT-5 mini and Claude Sonnet 5.5 don't accept a temperature setting, so their runs are less repeatable.

## Routing experiment: cheap model + tools, strong model only for dangerous goods (v6)

v6 = v5 on Gemini 2.5 Flash-Lite, plus one short, parallel question to a stronger model: "is this cargo dangerous goods? quote the product words". The quote must appear in the email (verified by code); if either the agent or the grounded check says dangerous goods, the shipment is treated as dangerous goods.

| Setup | All 15 | € at risk | Cost / 1,000 emails | Time / email |
|---|---|---|---|---|
| v5 Flash-Lite + tools | 14/15 | €5,500 | $0.51 | 2.9 s |
| v6 + Claude Sonnet 5.5 checker | **15/15** | **€0** | $2.56 | 2.9 s |
| **v6 + Claude Haiku 4.5 checker** | **15/15** | **€0** | **$1.20** | 3.7 s |
| (Claude Sonnet 5.5 + tools, v5) | 12/15 | €700 | $27.94 | 16.9 s |

- Both checkers caught the power banks ("lithium batteries, class 9") and raised **no false alarm** on any other case, in 4 Haiku runs and 1 Sonnet run.
- **Routing one judgment to a stronger model closed the €5,000 gap for about $0.70 per 1,000 emails**, at roughly 1/23 of the cost of running the strong model end to end, which scored lower.
- Haiku 4.5 matched Sonnet 5.5 for this narrow question at under half the cost, so it's the default checker.
- Caveat: one dangerous-goods case in the set. A real test needs many more products (and many safe ones that sound risky), which is the next step for the test set.

## Caveats

- **One run per configuration**, 15 cases: differences of one or two cases are within noise.
- **The tools and guardrails were built around the cheap model's failures** on the dev cases, which may favour it. The held-out cases were already spent, so this comparison uses all 15.
- **The test cases were written with a Claude model**, which may slightly favour Claude models.
- € figures are illustrative assumptions, not measured losses.
