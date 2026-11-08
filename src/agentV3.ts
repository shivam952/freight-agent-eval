// Reference agent v3: v2 (Incoterm tool + guardrails) + the seaport lookup tool.
// Step 1a: forced Incoterm tool call. Step 1b: forced seaport lookup for the delivery place.
// Step 2: answer sheet with both tool results. Then guardrails, including:
// the port of discharge must be one of the gateways the seaport tool returned.

import { SCHEMA, SYSTEM_PROMPT } from "./agent.js";
import { TOOL, TOOL_RULES, chat } from "./agentV1.js";
import { applyGuardrails } from "./guardrails.js";
import { incotermScope, type Role } from "./tools/incoterms.js";
import { seaportLookup, type PlaceInfo } from "./tools/seaports.js";
import type { Agent, AgentOutput } from "./types.js";

const SEAPORT_TOOL = {
  type: "function",
  function: {
    name: "seaport_lookup",
    description:
      "Given the final delivery place from the email, returns whether ocean vessels discharge there and which seaports serve it.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["delivery_place"],
      properties: {
        delivery_place: { type: "string", description: 'Final destination as written, e.g. "Hamburg-Billbrook", "Duisburg"' },
      },
    },
  },
} as const;

const SEAPORT_RULES = `

You also have seaport_lookup. port_of_discharge MUST be the locode of one of its "gateways" (use the first unless the email gives a reason), and your reply should state which port you assumed. Never use an inland place as port of discharge.`;

/** Guardrail: the port of discharge must come from the seaport tool, unless nothing is quoted. */
export function applyPortGuardrail(out: AgentOutput, place: PlaceInfo, nothingQuoted: boolean): string[] {
  if (nothingQuoted) return [];
  const valid = place.gateways.map((g) => g.locode);
  const port = (out.port_of_discharge ?? "").replace(/\s/g, "").toUpperCase();
  if (valid.includes(port)) return [];
  out.port_of_discharge = valid[0];
  return [`port ${port || "none"} -> ${valid[0]} (seaport tool: ${place.note})`];
}

export function makeReferenceAgentV3(model: string): Agent {
  return {
    name: `reference-v3/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const system = { role: "system", content: SYSTEM_PROMPT + TOOL_RULES + SEAPORT_RULES };
      const user = { role: "user", content: email };
      const forced = async (tool: typeof TOOL | typeof SEAPORT_TOOL) => {
        const r = await chat({
          model, temperature: 0, messages: [system, user], tools: [tool],
          tool_choice: { type: "function", function: { name: tool.function.name } },
        });
        const call = r.choices[0].message.tool_calls?.[0];
        if (!call) throw new Error(`model did not call ${tool.function.name}`);
        return JSON.parse(call.function.arguments);
      };

      const incArgs = (await forced(TOOL)) as { incoterm: string; asker_role: Role };
      const scope = incotermScope(incArgs.incoterm, incArgs.asker_role);
      const portArgs = (await forced(SEAPORT_TOOL)) as { delivery_place: string };
      const place = seaportLookup(portArgs.delivery_place);

      const second = await chat({
        model, temperature: 0,
        messages: [
          system, user,
          {
            role: "system",
            content:
              `Tool incoterm_scope(${JSON.stringify(incArgs)}) returned: ${JSON.stringify(scope)}.\n` +
              `Tool seaport_lookup(${JSON.stringify(portArgs)}) returned: ${JSON.stringify(place)}.\n` +
              "Now return the JSON answer sheet.",
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "answer_sheet", strict: true, schema: SCHEMA } },
      });
      const raw = JSON.parse(second.choices[0].message.content ?? "") as AgentOutput;
      const { output, interventions } = applyGuardrails(raw, scope);
      interventions.push(...applyPortGuardrail(output, place, scope.note === "asker_owns_no_legs"));
      return { ...output, trace: { raw, interventions } };
    },
  };
}
