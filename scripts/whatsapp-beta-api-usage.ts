/** Rehearsal-only accounting. Rates verified 2026-10-09; not an invoice. */
export class BetaApiUsage {
  requests = 0;
  successfulResponses = 0;
  responsesWithUsage = 0;
  promptTokens = 0;
  cachedPromptTokens = 0;
  completionTokens = 0;
  readonly httpErrors: Record<string, number> = {};

  record(status: number, payload?: unknown): void {
    if (status < 200 || status >= 300) {
      this.httpErrors[status] = (this.httpErrors[status] || 0) + 1;
      return;
    }
    this.successfulResponses++;
    const usage = (payload as {usage?: {prompt_tokens?:number;completion_tokens?:number;
      prompt_tokens_details?:{cached_tokens?:number}}} | null)?.usage;
    const valid = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 0;
    if (!usage || !valid(usage.prompt_tokens) || !valid(usage.completion_tokens)) return;
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    if (!valid(cached) || cached > usage.prompt_tokens) return;
    this.responsesWithUsage++;
    this.promptTokens += usage.prompt_tokens;
    this.cachedPromptTokens += cached;
    this.completionTokens += usage.completion_tokens;
  }

  summary(model: string) {
    const priced = model === 'gpt-4o-mini' || model === 'gpt-4o-mini-2024-07-18';
    return {
      model, requests: this.requests, successfulResponses: this.successfulResponses,
      responsesWithUsage: this.responsesWithUsage,
      usageComplete: this.responsesWithUsage === this.successfulResponses,
      promptTokens: this.promptTokens, cachedPromptTokens: this.cachedPromptTokens,
      completionTokens: this.completionTokens, httpErrors: {...this.httpErrors},
      estimatedReportedCostUsd: priced ? (
        (this.promptTokens - this.cachedPromptTokens) * 0.15 +
        this.cachedPromptTokens * 0.075 + this.completionTokens * 0.60
      ) / 1_000_000 : null,
      priceDate: priced ? '2026-10-09' : null,
      caveat: 'Estimate for reported text tokens at standard list prices; excludes other usage, taxes and account-specific billing. Missing usage is not zero usage.',
    };
  }
}
