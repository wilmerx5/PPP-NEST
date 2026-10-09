/** Retry only a rejected inference request; cart tools run outside this helper. */
export async function requestWhatsappInference(body: string, apiKey: string, options: {
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
} = {}): Promise<Response> {
  const fetcher = options.fetcher || globalThis.fetch;
  const wait = options.wait || ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const random = options.random || Math.random;
  const deadline = Date.now() + (options.timeoutMs ?? 15000);
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('openai_request_deadline');
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body,signal:AbortSignal.timeout(remaining),
    });
    if (attempt >= 2 || ![429,503].includes(response.status)) return response;
    let code: string | undefined;
    try { code = (await response.clone().json() as {error?:{code?:string}}).error?.code; } catch { return response; }
    const temporary = (response.status===429 && ['rate_limit_exceeded','slow_down'].includes(code || '')) ||
      (response.status===503 && code==='server_is_overloaded');
    if (!temporary) return response;
    const raw = response.headers.get('retry-after');
    const seconds = raw !== null && raw.trim() !== '' ? Number(raw) : NaN;
    const dateDelay = raw && !Number.isFinite(seconds) ? Date.parse(raw)-Date.now() : NaN;
    const serverDelay = Number.isFinite(seconds) && seconds>=0 ? seconds*1000 : dateDelay;
    const delay = (Number.isFinite(serverDelay) && serverDelay>=0 ? serverDelay : 250*2**attempt) + Math.floor(random()*100);
    // Do not retry sooner than a long server hint or beyond our time budget.
    if (delay>2500 || Date.now()+delay>=deadline) return response;
    await wait(delay);
  }
}
