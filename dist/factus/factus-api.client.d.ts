import { FactusAuthService } from './factus-auth.service';
import type { FactusBillDetail, FactusNumberingRange, FactusValidateBillRequest, FactusValidateBillResponse, FactusValidateCreditNoteRequest, FactusValidateCreditNoteResponse } from './types/factus.types';
export declare class FactusApiClient {
    private readonly auth;
    private readonly logger;
    constructor(auth: FactusAuthService);
    validateBill(payload: FactusValidateBillRequest): Promise<FactusValidateBillResponse>;
    validateCreditNote(payload: FactusValidateCreditNoteRequest): Promise<FactusValidateCreditNoteResponse>;
    getBill(number: string): Promise<FactusBillDetail>;
    listNumberingRanges(): Promise<FactusNumberingRange[]>;
    sendBillEmail(number: string, email: string): Promise<{
        message?: string;
    }>;
    downloadBillPdf(number: string): Promise<{
        buffer: Buffer;
        fileName: string;
    }>;
    private downloadPdfAt;
    private requestJson;
}
