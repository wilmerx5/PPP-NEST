import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
export type WhatsappHumanAlertPayload = {
    type: 'human_needed';
    conversationId: number;
    phoneE164: string;
    customerName: string | null;
    at: string;
};
export declare class WhatsappAdminAlertService {
    private readonly bus;
    notifyHumanNeeded(input: {
        conversationId: number;
        phoneE164: string;
        customerName?: string | null;
    }): void;
    asSse(): Observable<MessageEvent>;
}
