import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
export type ElectronicInvoiceStatus = 'none' | 'pending' | 'accepted' | 'rejected' | 'error';
export declare class FactusService {
    private readonly orderRepo;
    private readonly auth;
    private readonly api;
    private readonly mapper;
    private readonly logger;
    constructor(orderRepo: Repository<Order>, auth: FactusAuthService, api: FactusApiClient, mapper: FactusInvoiceMapper);
    getStatus(): {
        configured: boolean;
        env: string;
        baseUrl: string;
    };
    issueForOrder(orderId: number, dto: IssueElectronicInvoiceDto): Promise<{
        success: boolean;
        orderId: number;
        status: "accepted" | "rejected";
        number: string | null;
        cufe: string | null;
        publicUrl: string | null;
        qrUrl: string | null;
        message: string;
        errors: Record<string, unknown>;
        totals: {
            gross_amount?: string;
            tax_amount?: string;
            total?: string;
        } | undefined;
    }>;
}
