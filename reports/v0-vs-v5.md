# Regression report

- **Base:** `reference-v0/google/gemini-2.5-flash-lite` (2026-11-08T23:32:14.872Z)
- **New:** `reference-v5/google/gemini-2.5-flash-lite` (2026-11-09T00:11:30.750Z)
- **Compared:** 15 cases

| | Base | New |
|---|---|---|
| Dev cases passed | 1/10 | 10/10 |
| Easy cases passed | 0/4 | 4/4 |
| Holdout cases passed | 1/5 | 4/5 |
| € at risk (illustrative) | €17,550 | €5,500 |

## Regressions (passed before, fail now): 0


## Fixed (failed before, pass now): 12

- TC-001
- TC-002
- TC-003
- TC-004
- TC-005
- TC-007
- TC-008
- TC-009
- TC-010
- TC-012
- TC-013
- TC-014

## Still failing: 1

- TC-015: dangerous_goods (expected true, got false); action (expected one of ask/escalate, got quote); requested_info (expected sds AND un_number, got nothing) — €5,500 at risk

## Guardrail interventions in the new run: 6

- TC-001: action quote -> ask (dangerous goods)
- TC-001: requested_info + delivery_deadline (deadline at risk)
- TC-007: port none -> DEHAM (seaport tool: port_city)
- TC-012: action quote -> ask (information requested)
- TC-013: action quote -> ask (impossible deadline)
- TC-013: requested_info + delivery_deadline (deadline at risk)

## Verdict: ✅ safe to ship
