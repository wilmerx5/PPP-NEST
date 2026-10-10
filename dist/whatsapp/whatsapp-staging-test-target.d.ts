type EffectiveTestConfig = {
    enabled: boolean;
    agentV1Enabled: boolean;
    openaiModel: string;
    phoneNumberId: string | null;
    accessToken: string | null;
    appSecret: string | null;
    openaiApiKey: string | null;
    rateLimitPerMinute: number;
};
export declare function stagingTestTargetStatus(cfg: EffectiveTestConfig, target: {
    phoneNumberId: string;
    recipient: string;
}, env?: NodeJS.ProcessEnv): {
    staging: boolean;
    targetMatches: boolean;
    conversationTestVersion: string;
    botEnabled: boolean;
    agentEnabled: boolean;
    approvedModel: boolean;
    credentialsPresent: boolean;
    staffOrderEventsBlocked: boolean;
    factusSandbox: boolean;
    rateLimitPerMinute: number;
};
export {};
