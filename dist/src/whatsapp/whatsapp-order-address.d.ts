import type { WhatsappSessionData } from './types/whatsapp-session.types';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
export declare function composeWhatsappOrderAddress(session: Pick<WhatsappSessionData, 'address' | 'paymentMethod' | 'cashChangeFor' | 'customerNotes'>, paymentMethods?: WhatsappPaymentMethodConfig[]): string;
