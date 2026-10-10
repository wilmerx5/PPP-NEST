"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestWhatsappInference = requestWhatsappInference;
async function requestWhatsappInference(body, apiKey, options = {}) {
    const fetcher = options.fetcher || globalThis.fetch;
    const wait = options.wait || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    const random = options.random || Math.random;
    const deadline = Date.now() + (options.timeoutMs ?? 20000);
    for (let attempt = 0;; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0)
            throw new Error('openai_request_deadline');
        let response;
        try {
            response = await fetcher('https://api.openai.com/v1/chat/completions', {
                method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body, signal: AbortSignal.timeout(Math.min(remaining, options.attemptTimeoutMs ?? 12000)),
            });
            if (response.ok && typeof response.clone === 'function') {
                const bytes = await response.clone().arrayBuffer();
                response = new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
            }
        }
        catch (error) {
            const delay = 250 * 2 ** attempt + Math.floor(random() * 100);
            if (error?.name !== 'TimeoutError' || attempt >= 2 || Date.now() + delay + 1000 >= deadline)
                throw error;
            await wait(delay);
            continue;
        }
        if (attempt >= 2 || ![429, 503].includes(response.status))
            return response;
        let code;
        try {
            code = (await response.clone().json()).error?.code;
        }
        catch {
            return response;
        }
        const temporary = (response.status === 429 && ['rate_limit_exceeded', 'slow_down'].includes(code || '')) ||
            (response.status === 503 && code === 'server_is_overloaded');
        if (!temporary)
            return response;
        const raw = response.headers.get('retry-after');
        const seconds = raw !== null && raw.trim() !== '' ? Number(raw) : NaN;
        const dateDelay = raw && !Number.isFinite(seconds) ? Date.parse(raw) - Date.now() : NaN;
        const serverDelay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : dateDelay;
        const delay = (Number.isFinite(serverDelay) && serverDelay >= 0 ? serverDelay : 250 * 2 ** attempt) + Math.floor(random() * 100);
        if (delay > 2500 || Date.now() + delay >= deadline)
            return response;
        await wait(delay);
    }
}
//# sourceMappingURL=whatsapp-openai-request.js.map