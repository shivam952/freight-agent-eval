// € at risk: ILLUSTRATIVE cost assumptions per failed check, for ranking failures in business
// terms. These are not measured numbers. Replace them with a forwarder's real figures.
// A case's € at risk = sum of the costs of its failed checks, except that a dangerous-goods
// miss counts once at its (much higher) cost.

import type { CheckResult } from "./checks.js";

export const CHECK_COST_EUR: Record<string, number> = {
  customer: 400, // quote addressed to the wrong party: lost deal margin
  customer_role: 400, // wrong side of the contract: wrong scope, lost deal
  incoterm: 100, // misread terms (the legs check carries most of the cost)
  legs_quoted: 500, // one leg's margin: leaked if missing, lost deal if over-charged
  insurance_included: 150, // premium added or missing
  port_of_discharge: 300, // inland leg mispriced or invalid booking
  dangerous_goods: 5000, // dangerous goods booked as normal cargo: rejection, fines, safety
  action: 400, // quoted when it should have asked: rework, wrong price, lost trust
  deadline_risk: 1000, // promised an impossible or risky deadline: lost customer
  requested_info: 100, // asked the wrong thing or nothing: extra round trip, slower quote
};

export function eurAtRisk(checks: CheckResult[]): number {
  return checks.filter((c) => !c.pass).reduce((sum, c) => sum + (CHECK_COST_EUR[c.box] ?? 0), 0);
}
