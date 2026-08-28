import { StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { CancelElectronicInvoiceDto, ResendElectronicInvoiceEmailDto } from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { InvoiceCustomer } from './entities/invoice-customer.entity';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';
export declare class FactusService {
    private readonly orderRepo;
    private readonly customerRepo;
    private readonly config;
    private readonly auth;
    private readonly api;
    private readonly mapper;
    private readonly invoiceSettings;
    private readonly logger;
    private creditNoteRangeCache;
    private static readonly NC_RANGE_CACHE_MS;
    constructor(orderRepo: Repository<Order>, customerRepo: Repository<InvoiceCustomer>, config: ConfigService, auth: FactusAuthService, api: FactusApiClient, mapper: FactusInvoiceMapper, invoiceSettings: FactusInvoiceSettingsService);
    getStatus(): {
        configured: boolean;
        env: string;
        baseUrl: string;
    };
    lookupCustomer(docType: string, identification: string): Promise<{
        identificationDocumentCode: string;
        identification: string;
        dv: string | null;
        legalOrganizationCode: string;
        names: string | null;
        company: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        municipalityCode: string | null;
        timesUsed: number;
    } | null>;
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
    getInvoicePdf(orderId: number): Promise<StreamableFile>;
    resendInvoiceEmail(orderId: number, dto: ResendElectronicInvoiceEmailDto): Promise<{
        success: boolean;
        orderId: number;
        number: string | null;
        email: string;
        message: string;
    }>;
    cancelInvoice(orderId: number, dto: CancelElectronicInvoiceDto): Promise<{
        success: boolean;
        orderId: number;
        status: "accepted" | "credit_noted";
        billNumber: string;
        creditNoteNumber: string | null;
        creditNoteCufe: string | null;
        creditNotePublicUrl: string | null;
        message: string;
        errors: Record<string, unknown>;
    }>;
    private upsertInvoiceCustomer;
    private loadOrderForInvoice;
    private requireAcceptedInvoice;
    private requireConfigured;
    private ensureCreditNoteCustomer;
    private resolveCreditNoteRangeId;
    private isDebug;
}
