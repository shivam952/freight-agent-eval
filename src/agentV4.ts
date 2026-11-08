// Reference agent v4: v3 + a dedicated role step with grounded evidence.
// Step 0: focused role call; code verifies the evidence quote exists in the email,
//         otherwise the role becomes "unclear" and the agent must ask instead of quoting.
// Steps 1-2 and guardrails as in v3, but the Incoterm tool always receives the step-0 role,
// and the final customer_role is forced to it.
// Older agents (v0-v3) keep their own schema, so their results stay reproducible.

import { SCHEMA, SYSTEM_PROMPT } from "./agent.js";
import { TOOL, TOOL_RULES, chat } from "./agentV1.js";
import { applyPortGuardrail } from "./agentV3.js";
import { applyGuardrails } from "./guardrails.js";
import { determineRole } from "./role.js";
import { incotermScope, type Scope } from "./tools/incoterms.js";
import { seaportLookup } from "./tools/seaports.js";
import type { Agent, AgentOutput } from "./types.js";

const SCHEMA_V4 = {
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

const RULES_V4 = `

You also have seaport_lookup. port_of_discharge MUST be the locode of one of its "gateways" (use the first unless the email gives a reason), and your reply should state which port you assumed. Never use an inland place as port of discharge.
The customer's role has already been decided from evidence in the email; use it as given.`;

export function makeReferenceAgentV4(model: string): Agent {
  return {
    name: `reference-v4/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const role = await determineRole(model, email);
      const system = { role: "system", content: SYSTEM_PROMPT + TOOL_RULES + RULES_V4 };
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

      // The Incoterm comes from the model's tool call; the role comes from the grounded role step.
      const incArgs = (await forced(TOOL)) as { incoterm: string };
      const scope: Scope =
        role.role === "unclear"
          ? { legs: [], insurance: false, note: "unknown_role" }
          : incotermScope(incArgs.incoterm, role.role);
      const portArgs = (await forced(SEAPORT_TOOL)) as { delivery_place: string };
      const place = seaportLookup(portArgs.delivery_place);

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
              "Now return the JSON answer sheet.",
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "answer_sheet", strict: true, schema: SCHEMA_V4 } },
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
      return { ...output, trace: { raw, interventions } };
    },
  };
}
