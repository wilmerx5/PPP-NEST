import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

export type WhatsappHumanAlertPayload = {
  type: 'human_needed';
  conversationId: number;
  phoneE164: string;
  customerName: string | null;
  at: string;
};

/**
 * Bus de alertas admin: cuando un cliente pide ASESOR,
 * el stream SSE avisa al panel aunque la pestaña esté en segundo plano
 * (el polling del browser se congela y no sirve).
 */
@Injectable()
export class WhatsappAdminAlertService {
  private readonly bus = new Subject<WhatsappHumanAlertPayload>();

  notifyHumanNeeded(input: {
    conversationId: number;
    phoneE164: string;
    customerName?: string | null;
  }) {
    this.bus.next({
      type: 'human_needed',
      conversationId: input.conversationId,
      phoneE164: input.phoneE164,
      customerName: input.customerName ?? null,
      at: new Date().toISOString(),
    });
  }

  /** Stream SSE: connected + ping + human_needed. */
  asSse(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        type: 'connected',
        data: { type: 'connected', at: new Date().toISOString() },
      });

      const sub = this.bus.pipe(map((p) => ({ type: 'human_needed', data: p }))).subscribe({
        next: (ev) => subscriber.next(ev),
        error: (err) => subscriber.error(err),
      });

      const heartbeat = setInterval(() => {
        subscriber.next({
          type: 'ping',
          data: { type: 'ping', at: new Date().toISOString() },
        });
      }, 20000);

      return () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
      };
    });
  }
}
