import { FactusAuthService } from './factus-auth.service';
import type { FactusNumberingRange, FactusValidateBillRequest, FactusValidateBillResponse } from './types/factus.types';
export declare class FactusApiClient {
    private readonly auth;
    private readonly logger;
    constructor(auth: FactusAuthService);
    validateBill(payload: FactusValidateBillRequest): Promise<FactusValidateBillResponse>;
    listNumberingRanges(): Promise<FactusNumberingRange[]>;
    downloadBillPdf(number: string): Promise<Buffer>;
    private requestJson;
}
