// Token and cost tracking across all model calls (OpenRouter returns usage with each response).

/** Max output tokens per call: room for reasoning models, a guard against runaway cost. */
export const MAX_TOKENS = 4000;

/**
 * POST to OpenRouter, retrying rate limits (429) and server errors (5xx) with backoff,
 * so an infrastructure hiccup isn't counted as a wrong answer.
 */
export async function postWithRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, init);
    if (res.ok || i >= attempts || !(res.status === 429 || res.status >= 500)) return res;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (i - 1))); // 2 s, 4 s, 8 s
  }
}

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
