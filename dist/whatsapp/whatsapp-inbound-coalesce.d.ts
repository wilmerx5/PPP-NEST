import type { IncomingWhatsappMessage } from './whatsapp-meta.service';
export declare const WHATSAPP_INBOUND_COALESCE_MS = 3000;
export declare const WHATSAPP_INBOUND_COALESCE_QUICK_MS = 900;
export declare const WHATSAPP_INBOUND_COALESCE_MAX = 8;
export declare function isCoalesceableInboundMessage(msg: IncomingWhatsappMessage): boolean;
export declare function isQuickCoalesceText(text: string): boolean;
export declare function coalesceDelayMsForText(text: string): number;
export declare function coalesceDelayMsForBatch(messages: IncomingWhatsappMessage[]): number;
export declare function mergeCoalescedInboundMessages(messages: IncomingWhatsappMessage[]): IncomingWhatsappMessage;
