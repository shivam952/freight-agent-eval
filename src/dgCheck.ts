// Dangerous-goods check: one short, focused question to a (stronger) model.
// Recognising that "power banks" are lithium batteries is world knowledge, not a rule a tool
// can encode, so this is the one judgment we route to a model that knows more.
// The evidence must be quoted from the email (verified by code), like the role step.

import { chat } from "./agentV1.js";
import { isGrounded } from "./role.js";

export interface DgCheck {
  verdict: "yes" | "no" | "unsure";
  evidence: string; // product words quoted from the email
  grounded: boolean;
  reason: string; // e.g. "power banks are lithium-ion batteries (class 9)"
}

const DG_PROMPT = `You check one email sent to an ocean freight forwarder.
Question: does the cargo described count as dangerous goods for sea transport (IMDG), even if the email doesn't say so? Think about what the products contain (e.g. lithium batteries, flammable liquids, aerosols, gases, magnets).
Return JSON with:
- verdict: "yes", "no" or "unsure"
- evidence: copy the exact product words from the email, character for character
- reason: one short sentence (what makes it dangerous or not)`;

const DG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "evidence", "reason"],
  properties: {
    verdict: { type: "string", enum: ["yes", "no", "unsure"] },
    evidence: { type: "string" },
    reason: { type: "string" },
  },
} as const;

export async function checkDangerousGoods(model: string, email: string): Promise<DgCheck> {
  const r = await chat({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: DG_PROMPT },
      { role: "user", content: email },
    ],
    response_format: { type: "json_schema", json_schema: { name: "dg_check", strict: true, schema: DG_SCHEMA } },
  });
  const out = JSON.parse(r.choices[0].message.content ?? "") as Omit<DgCheck, "grounded">;
  return { ...out, grounded: isGrounded(out.evidence, email) };
}

/** Safety rule: if either the agent or a grounded check says dangerous goods, treat it as dangerous goods. */
export function combineDangerousGoods(agentSaysDg: boolean, check: DgCheck): { dg: boolean; overridden: boolean } {
  const checkSaysDg = check.verdict === "yes" && check.grounded;
  return { dg: agentSaysDg || checkSaysDg, overridden: !agentSaysDg && checkSaysDg };
}
