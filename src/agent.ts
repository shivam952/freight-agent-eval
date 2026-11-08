// Reference agent v0: one model call, no tools. It reads a freight email and
// fills in the answer sheet. Deliberately simple: it's the exam candidate, not the product.

import type { Agent, AgentOutput } from "./types.js";

const SYSTEM_PROMPT = `You are an operations assistant at an ocean freight forwarder.
You receive one customer email (it may be a forwarded thread) and must decide how to handle it.

Return ONLY a JSON object with these fields:
- customer: the person and company asking us for the quote (the sender we reply to, not a third party quoted in the thread)
- customer_role: "buyer" or "seller" in the sales contract
- incoterm: the Incoterm code, e.g. "EXW", "FOB", "CIF"
- legs_quoted: which legs our quote covers, as numbers: 1 = pickup to origin port, 2 = export customs, 3 = sea freight, 4 = import customs and duties, 5 = delivery from destination port to final place
- insurance_included: whether our quote includes cargo insurance
- port_of_discharge: UN/LOCODE of the destination seaport (e.g. "NLRTM"), or null if unknown
- dangerous_goods: whether the cargo is dangerous goods
- action: "quote" (send a price), "ask" (ask the customer for missing information first), or "escalate" (hand to a human specialist)
- reply_email: the email you would send back`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "customer", "customer_role", "incoterm", "legs_quoted", "insurance_included",
    "port_of_discharge", "dangerous_goods", "action", "reply_email",
  ],
  properties: {
    customer: { type: "string" },
    customer_role: { type: "string", enum: ["buyer", "seller"] },
    incoterm: { type: "string" },
    legs_quoted: { type: "array", items: { type: "integer", minimum: 1, maximum: 5 } },
    insurance_included: { type: "boolean" },
    port_of_discharge: { type: ["string", "null"] },
    dangerous_goods: { type: "boolean" },
    action: { type: "string", enum: ["quote", "ask", "escalate"] },
    reply_email: { type: "string" },
  },
} as const;

export function makeReferenceAgent(model: string, version = "v0"): Agent {
  return {
    name: `reference-${version}/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In the cloud session the network proxy replaces this with the saved key.
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? "proxy-injected"}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: email },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "answer_sheet", strict: true, schema: SCHEMA },
          },
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return JSON.parse(data.choices[0].message.content) as AgentOutput;
    },
  };
}
