# Regression report

- **Base:** `reference-v4/google/gemini-2.5-flash-lite` (2026-11-08T23:58:10.227Z)
- **New:** `reference-v3/google/gemini-2.5-flash-lite` (2026-11-08T23:51:26.274Z)
- **Compared:** 15 cases

| | Base | New |
|---|---|---|
| Dev cases passed | 9/10 | 8/10 |
| Easy cases passed | 4/4 | 3/4 |
| Holdout cases passed | 2/5 | 2/5 |
| € at risk (illustrative) | €7,600 | €8,500 |

## Regressions (passed before, fail now): 1

- **TC-002**: customer_role (expected buyer, got seller); legs_quoted (expected 3,4,5, got 1,2) — €900 at risk

## Fixed (failed before, pass now): 0


## Still failing: 4

- TC-001: requested_info (expected sds AND un_number AND delivery_deadline, got sds,un_number) — €100 at risk
- TC-012: legs_quoted (expected 3,4,5, got 1,2) — €500 at risk
- TC-013: action (expected one of ask, got quote); deadline_risk (expected one of impossible, got at_risk); requested_info (expected delivery_deadline, got nothing) — €1,500 at risk
- TC-015: dangerous_goods (expected true, got false); action (expected one of ask/escalate, got quote); requested_info (expected sds AND un_number, got nothing) — €5,500 at risk

## Guardrail interventions in the new run: 2

- TC-001: action quote -> ask (dangerous goods)
- TC-012: action quote -> ask (information requested)

## Verdict: ❌ do not ship
- 1 regression(s): TC-002
- easy case(s) failing: TC-002
