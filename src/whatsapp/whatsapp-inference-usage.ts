/** Provider counters, not prices. Missing usage must never be reported as free. */
export type WhatsappInferenceUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
};
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function readWhatsappInferenceUsage(raw: unknown, api: 'responses' | 'chat/completions'): WhatsappInferenceUsage | null {
  const usage = (raw as any)?.usage;
  if (!usage || typeof usage !== 'object') return null;
  const responses = api === 'responses';
  const inputTokens = count(responses ? usage.input_tokens : usage.prompt_tokens);
  const outputTokens = count(responses ? usage.output_tokens : usage.completion_tokens);
  if (inputTokens === null || outputTokens === null) return null;
  const input = responses ? usage.input_tokens_details : usage.prompt_tokens_details;
  const output = responses ? usage.output_tokens_details : usage.completion_tokens_details;
  const cached = count(input?.cached_tokens);
  const written = count(input?.cache_write_tokens);
  const reasoning = count(output?.reasoning_tokens);
  return { inputTokens, outputTokens,
    cachedInputTokens: cached !== null && cached <= inputTokens ? cached : null,
    cacheWriteTokens: written !== null && written <= inputTokens ? written : null,
    reasoningTokens: reasoning !== null && reasoning <= outputTokens ? reasoning : null };
}
export type WhatsappInferenceAttempt = {
  requestId: string;
  attempt: number;
  api: 'responses' | 'chat/completions';
  status: number | null;
  outcome: 'response' | 'timeout' | 'transport_error';
  latencyMs: number;
  usage: WhatsappInferenceUsage | null;
};
