// Reference agent v1: v0 plus the Incoterm rules tool.
// Step 1: the model must call incoterm_scope with the Incoterm and the asker's role.
// Step 2: we run the tool (plain code) and give the result back; the model fills in the answer sheet.
// The model is told to use the tool's legs and insurance, but nothing forces it to:
// the harness measures whether it actually does.

import { SCHEMA, SYSTEM_PROMPT } from "./agent.js";
import { incotermScope, type Role } from "./tools/incoterms.js";
import type { Agent, AgentOutput } from "./types.js";

const TOOL = {
  type: "function",
  function: {
    name: "incoterm_scope",
    description:
      "Returns which legs the asking party owns under an Incoterm, whether they pay cargo insurance, and a note. Use \"UNKNOWN\" if the email gives no Incoterm.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["incoterm", "asker_role"],
      properties: {
        incoterm: { type: "string", description: 'Incoterm code from the email, e.g. "FOB", or "UNKNOWN"' },
        asker_role: { type: "string", enum: ["buyer", "seller"], description: "Role of the person asking us for the quote" },
      },
    },
  },
} as const;

const TOOL_RULES = `

You have a tool, incoterm_scope. Its result is authoritative:
- legs_quoted MUST equal the tool's "legs", and insurance_included MUST equal its "insurance".
- note "unknown_incoterm": quote nothing yet; action "ask"; requested_info must include "incoterm".
- note "asker_owns_no_legs": quote nothing; action "ask"; port_of_discharge null; explain who arranges transport and ask for the counterparty's contact ("counterparty_contact").
- note "named_place_needed": action "ask" for the named place before quoting.`;

async function chat(body: object) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? "proxy-injected"}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
  };
}

export function makeReferenceAgentV1(model: string): Agent {
  return {
    name: `reference-v1/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const system = { role: "system", content: SYSTEM_PROMPT + TOOL_RULES };
      const user = { role: "user", content: email };

      // Step 1: force exactly one call to the Incoterm tool.
      const first = await chat({
        model,
        temperature: 0,
        messages: [system, user],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "incoterm_scope" } },
      });
      const call = first.choices[0].message.tool_calls?.[0];
      if (!call) throw new Error("model did not call incoterm_scope");
      const args = JSON.parse(call.function.arguments) as { incoterm: string; asker_role: Role };
      const scope = incotermScope(args.incoterm, args.asker_role);

      // Step 2: give the tool result back as a plain message (some models, e.g. Gemini 2.5
      // Flash-Lite, can't combine tool calls with structured output in one request).
      const second = await chat({
        model,
        temperature: 0,
        messages: [
          system,
          user,
          {
            role: "system",
            content: `Tool incoterm_scope(${JSON.stringify(args)}) returned: ${JSON.stringify(scope)}. Now return the JSON answer sheet.`,
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: "answer_sheet", strict: true, schema: SCHEMA } },
      });
      return JSON.parse(second.choices[0].message.content ?? "") as AgentOutput;
    },
  };
}
