// Token and cost tracking across all model calls (OpenRouter returns usage with each response).

/** Max output tokens per call: room for reasoning models, a guard against runaway cost. */
export const MAX_TOKENS = 4000;

export interface Usage {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
}

let current: Usage = { calls: 0, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };

export function resetUsage(): void {
  current = { calls: 0, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };
}

export function recordUsage(u?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }): void {
  current.calls += 1;
  current.prompt_tokens += u?.prompt_tokens ?? 0;
  current.completion_tokens += u?.completion_tokens ?? 0;
  current.cost_usd += u?.cost ?? 0;
}

export function getUsage(): Usage {
  return { ...current };
}
