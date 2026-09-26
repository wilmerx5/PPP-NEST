import { Injectable, Logger } from '@nestjs/common';

export type WhatsappTurnPath = 'rules' | 'ai_legacy' | 'agent_v1' | 'hybrid';

export type WhatsappTurnOutcome =
  | 'replied'
  | 'order_progress'
  | 'handoff'
  | 'abandoned_pending'
  | 'error'
  | 'fallback_rules';

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

/**
 * Telemetría de turnos WhatsApp (Fase 0 SaaS).
 * Hoy: logs estructurados. Mañana: tabla / analytics por tenant.
 */
@Injectable()
export class WhatsappTurnTelemetryService {
  private readonly logger = new Logger('WaTurnTelemetry');
  /** Ring buffer en memoria para debug admin (últimos N). */
  private readonly recent: WhatsappTurnTelemetryEvent[] = [];
  private readonly maxRecent = 100;

  record(event: Omit<WhatsappTurnTelemetryEvent, 'at'> & { at?: string }): void {
    const full: WhatsappTurnTelemetryEvent = {
      ...event,
      at: event.at || new Date().toISOString(),
      userTextPreview: event.userTextPreview?.slice(0, 120),
      replyPreview: event.replyPreview?.slice(0, 160),
    };
    this.recent.push(full);
    if (this.recent.length > this.maxRecent) this.recent.shift();
    this.logger.log(JSON.stringify(full));
  }

  getRecent(limit = 30): WhatsappTurnTelemetryEvent[] {
    return this.recent.slice(-Math.max(1, Math.min(limit, this.maxRecent)));
  }
}
