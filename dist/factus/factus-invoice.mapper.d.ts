import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/entities/order.entity';
import type { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import type { InvoiceCustomer } from './entities/invoice-customer.entity';
import type { ResolvedFactusTaxConfig } from './factus-invoice-settings.types';
import type { FactusBillDetail, FactusCustomer, FactusValidateBillRequest, FactusValidateCreditNoteRequest } from './types/factus.types';
export declare function factusMoney(n: number): string;
export declare class FactusInvoiceMapper {
    private readonly config;
    constructor(config: ConfigService);
    buildValidatePayload(order: Order, dto: IssueElectronicInvoiceDto, taxConfig: ResolvedFactusTaxConfig): {
        payload: FactusValidateBillRequest;
        invoiceTotal: number;
    };
    buildCreditNotePayload(order: Order, opts: {
        observation?: string;
        correctionConceptCode?: string;
        savedCustomer?: InvoiceCustomer | null;
        numberingRangeId: number;
        taxConfig: ResolvedFactusTaxConfig;
    }): FactusValidateCreditNoteRequest;
    customerFromBillDetail(bill: FactusBillDetail): FactusCustomer;
    private buildCreditNoteCustomer;
    private combinedTaxRatePercent;
    private netUnitPrice;
    private buildItemTaxes;
    private toFactusBillItem;
    private mapItems;
    private mapExtras;
    private deliveryAsExtra;
    private sumItemsGross;
    private toYmd;
}
