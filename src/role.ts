// Role step: a dedicated, focused LLM judgment ("who is asking: buyer or seller?") that must
// quote its evidence. Plain code then verifies the quote really appears in the email.
// The model judges; the code checks the evidence exists. An ungrounded answer becomes "unclear".

import { chat } from "./agentV1.js";

export type RoleDecision = "buyer" | "seller" | "unclear";

export interface RoleResult {
  role: RoleDecision; // after the grounding check
  modelRole: RoleDecision; // what the model said
  evidence: string;
  grounded: boolean;
}

const ROLE_PROMPT = `You read one email sent to an ocean freight forwarder (it may contain a forwarded thread).
Decide the sales-contract role of the person who sent it to us and expects our reply:
- "buyer": they purchase the goods (importer/consignee side)
- "seller": they sell the goods (exporter/shipper side)
- "unclear": the email does not reveal it

Return JSON with:
- role
- evidence: copy the exact words from the email that show the role, character for character (empty if unclear)`;

const ROLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["role", "evidence"],
  properties: {
    role: { type: "string", enum: ["buyer", "seller", "unclear"] },
    evidence: { type: "string" },
  },
} as const;

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The evidence must be a real quote from the email (case and whitespace ignored), not a paraphrase. */
export function isGrounded(evidence: string, email: string): boolean {
  const e = squash(evidence);
  return e.length >= 8 && squash(email).includes(e);
}

export async function determineRole(model: string, email: string): Promise<RoleResult> {
  const r = await chat({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: ROLE_PROMPT },
      { role: "user", content: email },
    ],
    response_format: { type: "json_schema", json_schema: { name: "role", strict: true, schema: ROLE_SCHEMA } },
  });
  const { role, evidence } = JSON.parse(r.choices[0].message.content ?? "") as { role: RoleDecision; evidence: string };
  const grounded = role !== "unclear" && isGrounded(evidence, email);
  return { role: grounded ? role : "unclear", modelRole: role, evidence, grounded };
}
