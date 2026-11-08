// Guardrails: plain code that runs AFTER the model and enforces rules a prompt can't guarantee.
// Every change is recorded, so the harness can report how often the model needed correcting.
//
// Known limits:
// - Guardrails only fix contradictions the model reveals. If it misses dangerous goods
//   entirely (dangerous_goods = false), nothing here can catch it.
// - The reply email is NOT rewritten. If a guardrail turns a quote into "ask", the text may
//   still read like a quote; in production that email must be regenerated or sent to a human.

import type { Scope } from "./tools/incoterms.js";
import type { AgentOutput, RequestedInfo } from "./types.js";

export function applyGuardrails(raw: AgentOutput, scope: Scope): { output: AgentOutput; interventions: string[] } {
  const out: AgentOutput = { ...raw, legs_quoted: [...raw.legs_quoted], requested_info: [...raw.requested_info] };
  const interventions: string[] = [];
  const need = (item: RequestedInfo) => {
    if (!out.requested_info.includes(item)) out.requested_info.push(item);
  };
  const setAction = (a: AgentOutput["action"], why: string) => {
    if (out.action !== a && !(a === "ask" && out.action === "escalate")) {
      interventions.push(`action ${out.action} -> ${a} (${why})`);
      out.action = a;
    }
  };

  // 1. The Incoterm tool is authoritative for legs and insurance.
  const sameLegs = [...out.legs_quoted].sort().join() === [...scope.legs].sort().join();
  if (!sameLegs) {
    interventions.push(`legs ${out.legs_quoted.join(",") || "none"} -> ${scope.legs.join(",") || "none"} (tool)`);
    out.legs_quoted = [...scope.legs];
  }
  if (out.insurance_included !== scope.insurance) {
    interventions.push(`insurance ${out.insurance_included} -> ${scope.insurance} (tool)`);
    out.insurance_included = scope.insurance;
  }

  // 2. The tool's notes decide what can't be quoted.
  if (scope.note === "unknown_incoterm") {
    need("incoterm");
    setAction("ask", "no Incoterm");
  }
  if (scope.note === "asker_owns_no_legs") {
    need("counterparty_contact");
    if (out.port_of_discharge !== null) {
      interventions.push(`port ${out.port_of_discharge} -> none (nothing quoted)`);
      out.port_of_discharge = null;
    }
    setAction("ask", "asker owns no legs");
  }

  if (scope.note === "unknown_role") setAction("ask", "role unclear");

  // 3. Never quote dangerous goods directly, an impossible deadline, or with open questions.
  if (out.dangerous_goods && out.action === "quote") {
    need("sds");
    need("un_number");
    setAction("ask", "dangerous goods");
  }
  if (out.deadline_risk === "impossible" && out.action === "quote") setAction("ask", "impossible deadline");
  if (out.requested_info.length > 0 && out.action === "quote") setAction("ask", "information requested");

  return { output: out, interventions };
}
