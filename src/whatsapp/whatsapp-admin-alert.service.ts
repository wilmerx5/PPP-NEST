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
 * Bus de alertas admin/desk: cuando un cliente pide ASESOR,
 * el stream SSE avisa al panel aunque la pestaña esté en segundo plano
 * (el polling del browser se congela y no sirve).
 *
 * Nota: Subject en memoria → con varias réplicas Nest el evento solo llega
 * a clientes conectados a la misma instancia. El front también hace polling.
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
        data: JSON.stringify({ type: 'connected', at: new Date().toISOString() }),
      });

      const sub = this.bus
        .pipe(
          map((p) => ({
            type: 'human_needed',
            data: JSON.stringify(p),
          })),
        )
        .subscribe({
          next: (ev) => subscriber.next(ev),
          error: (err) => subscriber.error(err),
        });

      const heartbeat = setInterval(() => {
        subscriber.next({
          type: 'ping',
          data: JSON.stringify({ type: 'ping', at: new Date().toISOString() }),
        });
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
      };
    });
  }
}
