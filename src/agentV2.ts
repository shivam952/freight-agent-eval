// Reference agent v2: v1 (Incoterm tool) + guardrails in code.
// The raw model answer is kept in `trace`, so the harness can score the model alone too.

import { runV1 } from "./agentV1.js";
import { applyGuardrails } from "./guardrails.js";
import type { Agent, AgentOutput } from "./types.js";

export function makeReferenceAgentV2(model: string): Agent {
  return {
    name: `reference-v2/${model}`,
    async run(email: string): Promise<AgentOutput> {
      const { output: raw, scope } = await runV1(model, email);
      const { output, interventions } = applyGuardrails(raw, scope);
      return { ...output, trace: { raw, interventions } };
    },
  };
}
