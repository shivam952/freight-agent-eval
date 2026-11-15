// Reference agent v6: v5 (cheap model + tools + guardrails) plus a dangerous-goods check by a
// stronger model, run in parallel. Routing: the cheap model does everything; only the
// world-knowledge judgment "is this cargo dangerous goods?" goes to the strong model.
// Checker model: DG_MODEL environment variable (default: Claude Haiku 4.5).

import { makeReferenceAgentV5 } from "./agentV5.js";
import { checkDangerousGoods, combineDangerousGoods } from "./dgCheck.js";
import type { Agent, AgentOutput } from "./types.js";

export const DEFAULT_DG_MODEL = "anthropic/claude-haiku-4.5"; // matched Sonnet 5.5 at <1/2 the cost

export function makeReferenceAgentV6(model: string, dgModel = process.env.DG_MODEL ?? DEFAULT_DG_MODEL): Agent {
  const v5 = makeReferenceAgentV5(model);
  return {
    name: `reference-v6/${model}+dg:${dgModel}`,
    async run(email: string): Promise<AgentOutput> {
      const [out, check] = await Promise.all([v5.run(email), checkDangerousGoods(dgModel, email)]);
      const interventions = [...(out.trace?.interventions ?? [])];
      const { dg, overridden } = combineDangerousGoods(out.dangerous_goods, check);
      if (overridden) {
        interventions.push(`dangerous_goods false -> true (DG check: "${check.evidence}": ${check.reason})`);
        out.dangerous_goods = dg;
        for (const item of ["sds", "un_number"] as const) {
          if (!out.requested_info.includes(item)) out.requested_info.push(item);
        }
        if (out.action === "quote") {
          interventions.push("action quote -> ask (dangerous goods)");
          out.action = "ask";
        }
      }
      return { ...out, trace: { raw: out.trace?.raw ?? out, interventions } };
    },
  };
}
