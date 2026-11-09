// Reference agent v5: v4 (grounded role, Incoterm + seaport tools, guardrails) + date tool.
// The model maps messy date text to "YYYY-MM-DD" or "YYYY-Www"; the tool does the arithmetic
// against a FROZEN reference date, so results don't drift as real time passes.

import { SCHEMA, SYSTEM_PROMPT } from "./agent.js";
import { TOOL, TOOL_RULES, chat } from "./agentV1.js";
import { applyPortGuardrail } from "./agentV3.js";
import { applyGuardrails } from "./guardrails.js";
import { determineRole } from "./role.js";
import { deadlineCheck, type DateCheck } from "./tools/dates.js";
import { incotermScope, type Scope } from "./tools/incoterms.js";
import { seaportLookup } from "./tools/seaports.js";
import type { Agent, AgentOutput } from "./types.js";

/** Frozen "today" for every test run (the test emails were written around this date). */
export const REFERENCE_DATE = "2026-11-08";

const SCHEMA_V5 = {
  ...SCHEMA,
  properties: { ...SCHEMA.properties, customer_role: { type: "string", enum: ["buyer", "seller", "unclear"] } },
};

const SEAPORT_TOOL = {
  type: "function",
  function: {
    name: "seaport_lookup",
    description: "Given the final delivery place from the email, returns whether ocean vessels discharge there and which seaports serve it.",
    parameters: {
      type: "object", additionalProperties: false, required: ["delivery_place"],
      properties: { delivery_place: { type: "string", description: 'Final destination as written, e.g. "Hamburg-Billbrook"' } },
    },
  },
} as const;

const DATE_TOOL = {
  type: "function",
  function: {
    name: "deadline_check",
    description:
      `Today is ${REFERENCE_DATE}. Convert the email's cargo-ready time and delivery deadline into dates; the tool computes the arrival window and deadline risk.`,
    parameters: {
      type: "object", additionalProperties: false, required: ["cargo_ready", "deadline"],
      properties: {
        cargo_ready: { type: "string", description: 'When cargo is ready: "YYYY-MM-DD", or ISO week "YYYY-Www" (e.g. "rdy KW46" -> "2026-W46"), or "" if not stated' },
        deadline: { type: "string", description: 'Latest acceptable arrival at the customer: "YYYY-MM-DD" (for a vague deadline such as a holiday or season, use the latest plausible date) or "" if none' },
      },
    },
  },
} as const;

const RULES_V5 = `

You also have seaport_lookup. port_of_discharge MUST be the locode of one of its "gateways" (use the first unless the email gives a reason), and your reply should state which port you assumed. Never use an inland place as port of discharge.
The customer's role has already been decided from evidence in the email; use it as given.
deadline_risk MUST equal the deadline_check result's "risk". If there is a risk, say so plainly in the reply and never promise the deadline.`;

/** Date guardrails: the tool's risk wins; any deadline risk means we ask about the deadline. */
export function applyDateGuardrail(out: AgentOutput, check: DateCheck): string[] {
  const notes: string[] = [];
  if (check.note === "ok" || check.note === "no_deadline") {
    if (out.deadline_risk !== check.risk) {
      notes.push(`deadline_risk ${out.deadline_risk} -> ${check.risk} (date tool)`);
      out.deadline_risk = check.risk;
    }
  }
  if (out.deadline_risk !== "none" && !out.requested_info.includes("delivery_deadline")) {
    out.requested_info.push("delivery_deadline");
    notes.push("requested_info + delivery_deadline (deadline at risk)");
  }
  if (out.deadline_risk !== "none" && out.action === "quote") {
    out.action = "ask";
    notes.push("action quote -> ask (deadline at risk)");
  }
  return notes;
}

export function makeReferenceAgentV5(model: string): Agent {
  return {
    name: `reference-v5/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const role = await determineRole(model, email);
      const system = { role: "system", content: SYSTEM_PROMPT + TOOL_RULES + RULES_V5 };
      const user = { role: "user", content: email };
      const forced = async (tool: typeof TOOL | typeof SEAPORT_TOOL | typeof DATE_TOOL) => {
        const r = await chat({
          model, temperature: 0, messages: [system, user], tools: [tool],
          tool_choice: { type: "function", function: { name: tool.function.name } },
        });
        const call = r.choices[0].message.tool_calls?.[0];
        if (!call) throw new Error(`model did not call ${tool.function.name}`);
        return JSON.parse(call.function.arguments);
      };

      const incArgs = (await forced(TOOL)) as { incoterm: string };
      const scope: Scope =
        role.role === "unclear" ? { legs: [], insurance: false, note: "unknown_role" } : incotermScope(incArgs.incoterm, role.role);
      const portArgs = (await forced(SEAPORT_TOOL)) as { delivery_place: string };
      const place = seaportLookup(portArgs.delivery_place);
      const dateArgs = (await forced(DATE_TOOL)) as { cargo_ready: string; deadline: string };
      const dates = deadlineCheck(dateArgs.cargo_ready, dateArgs.deadline, !place.is_ocean_gateway);

      const second = await chat({
        model, temperature: 0,
        messages: [
          system, user,
          {
            role: "system",
            content:
              `Role decided from the email: ${role.role} (evidence: "${role.evidence}").\n` +
              `Tool incoterm_scope(${JSON.stringify({ incoterm: incArgs.incoterm, asker_role: role.role })}) returned: ${JSON.stringify(scope)}.\n` +
              `Tool seaport_lookup(${JSON.stringify(portArgs)}) returned: ${JSON.stringify(place)}.\n` +
              `Tool deadline_check(${JSON.stringify(dateArgs)}) returned: ${JSON.stringify(dates)}.\n` +
              "Now return the JSON answer sheet.",
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "answer_sheet", strict: true, schema: SCHEMA_V5 } },
      });
      const raw = JSON.parse(second.choices[0].message.content ?? "") as AgentOutput;
      const { output, interventions } = applyGuardrails(raw, scope);
      if (!role.grounded && role.modelRole !== "unclear") {
        interventions.push(`role ${role.modelRole} -> unclear (evidence not found in email: "${role.evidence}")`);
      }
      if (output.customer_role !== role.role) {
        interventions.push(`customer_role ${output.customer_role} -> ${role.role} (role step)`);
        output.customer_role = role.role;
      }
      interventions.push(...applyPortGuardrail(output, place, scope.note === "asker_owns_no_legs"));
      interventions.push(...applyDateGuardrail(output, dates));
      return { ...output, trace: { raw, interventions } };
    },
  };
}
