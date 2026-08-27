import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/entities/order.entity';
import type { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import type { FactusValidateBillRequest } from './types/factus.types';
export declare function factusMoney(n: number): string;
export declare class FactusInvoiceMapper {
    private readonly config;
    constructor(config: ConfigService);
    buildValidatePayload(order: Order, dto: IssueElectronicInvoiceDto): {
        payload: FactusValidateBillRequest;
        invoiceTotal: number;
    };
    private mapItems;
    private mapExtras;
    private deliveryAsExtra;
    private sumItemsGross;
    private toYmd;
}
