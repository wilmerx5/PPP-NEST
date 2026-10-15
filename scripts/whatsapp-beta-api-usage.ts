/** Rehearsal-only accounting. Rates verified 2026-10-09; not an invoice. */
export class BetaApiUsage {
  requests = 0;
  successfulResponses = 0;
  responsesWithUsage = 0;
  promptTokens = 0;
  cachedPromptTokens = 0;
  completionTokens = 0;
  reasoningTokens = 0;
  uncertainResponses = 0;
  blockingProviderErrorCode?: string;
  readonly httpErrors: Record<string, number> = {};
  readonly providerErrorCodes: Record<string,number> = {};
  readonly transportErrors: Record<string,number> = {};

  recordTransportFailure(error:unknown):void {
    this.uncertainResponses++;
    const code=(error as {name?:string})?.name==='TimeoutError' ? 'timeout' : 'transport_error';
    this.transportErrors[code]=(this.transportErrors[code] || 0)+1;
  }

  record(status: number, payload?: unknown): void {
    if (status < 200 || status >= 300) {
      this.httpErrors[status] = (this.httpErrors[status] || 0) + 1;
      const value=(payload as {error?:{code?:unknown}} | null)?.error?.code;
      const code=typeof value==='string' && /^[a-z_]{1,60}$/.test(value) ? value : 'unclassified';
      this.providerErrorCodes[code]=(this.providerErrorCodes[code] || 0)+1;
      if(['credit_balance_exhausted','insufficient_quota','billing_hard_limit_reached'].includes(code)) {
        this.blockingProviderErrorCode=code;
      }
      return;
    }
    this.successfulResponses++;
    const raw = (payload as {usage?: Record<string,any>} | null)?.usage;
    const usage = raw ? {prompt_tokens:raw.prompt_tokens ?? raw.input_tokens,
      completion_tokens:raw.completion_tokens ?? raw.output_tokens,
      prompt_tokens_details:raw.prompt_tokens_details ?? raw.input_tokens_details} : undefined;
    const valid = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 0;
    if (!usage || !valid(usage.prompt_tokens) || !valid(usage.completion_tokens)) return;
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    if (!valid(cached) || cached > usage.prompt_tokens) return;
    this.responsesWithUsage++;
    this.promptTokens += usage.prompt_tokens;
    this.cachedPromptTokens += cached;
    this.completionTokens += usage.completion_tokens;
    const reasoning=raw?.output_tokens_details?.reasoning_tokens ?? raw?.completion_tokens_details?.reasoning_tokens;
    if(valid(reasoning))this.reasoningTokens+=reasoning;
  }

  summary(model: string) {
    const rates:Record<string,[number,number,number]>={
      'gpt-4o-mini':[0.15,0.075,0.60],'gpt-4o-mini-2024-07-18':[0.15,0.075,0.60],
      'gpt-4.1-2025-04-14':[2,0.5,8],'gpt-6.1-sol':[2,0.1,10],'gpt-6-luna':[0.1,0.01,0.5],
    };
    const rate=rates[model];
    return {
      model, requests: this.requests, successfulResponses: this.successfulResponses,
      responsesWithUsage: this.responsesWithUsage,
      usageComplete: this.responsesWithUsage === this.successfulResponses && this.uncertainResponses===0,
      uncertainResponses:this.uncertainResponses,transportErrors:{...this.transportErrors},
      promptTokens: this.promptTokens, cachedPromptTokens: this.cachedPromptTokens,
      completionTokens: this.completionTokens, reasoningTokens:this.reasoningTokens, httpErrors: {...this.httpErrors},providerErrorCodes:{...this.providerErrorCodes},
      estimatedReportedCostUsd: rate ? (
        (this.promptTokens - this.cachedPromptTokens) * rate[0] +
        this.cachedPromptTokens * rate[1] + this.completionTokens * rate[2]
      ) / 1_000_000 : null,
      priceDate: rate ? '2026-10-15' : null,
      caveat: 'Estimate for reported text tokens at standard list prices; excludes other usage, taxes and account-specific billing. Missing usage is not zero usage.',
    };
  }
}
