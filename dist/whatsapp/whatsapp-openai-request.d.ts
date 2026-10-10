export declare function requestWhatsappInference(body: string, apiKey: string, options?: {
    fetcher?: typeof fetch;
    wait?: (ms: number) => Promise<void>;
    random?: () => number;
    timeoutMs?: number;
    attemptTimeoutMs?: number;
}): Promise<Response>;
