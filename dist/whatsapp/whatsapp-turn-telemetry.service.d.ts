export type WhatsappTurnPath = 'rules' | 'ai_legacy' | 'agent_v1' | 'hybrid';
export type WhatsappTurnOutcome = 'replied' | 'order_progress' | 'handoff' | 'abandoned_pending' | 'error' | 'fallback_rules';
export type WhatsappTurnTelemetryEvent = {
    at: string;
    waId?: string;
    conversationId?: number;
    path: WhatsappTurnPath;
    outcome: WhatsappTurnOutcome;
    toolCalls?: string[];
    warnings?: string[];
    latencyMs?: number;
    userTextPreview?: string;
    replyPreview?: string;
};
export declare class WhatsappTurnTelemetryService {
    private readonly logger;
    private readonly recent;
    private readonly maxRecent;
    record(event: Omit<WhatsappTurnTelemetryEvent, 'at'> & {
        at?: string;
    }): void;
    getRecent(limit?: number): WhatsappTurnTelemetryEvent[];
}
