import { StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { ProductsService } from '../products/products.service';
import { CancelElectronicInvoiceDto, ResendElectronicInvoiceEmailDto } from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { BulkElectronicInvoiceIssueDto, BulkElectronicInvoicePreviewDto } from './dto/bulk-electronic-invoice.dto';
import { InvoiceCustomer } from './entities/invoice-customer.entity';
import { FactusStandaloneInvoice } from './entities/factus-standalone-invoice.entity';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';
import type { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import { type BulkInvoicePlan } from './factus-bulk-select.util';
type InvoiceCustomerRow = {
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
    updatedAt?: Date;
};
export declare class FactusService {
    private readonly orderRepo;
    private readonly customerRepo;
    private readonly standaloneInvoiceRepo;
    private readonly config;
    private readonly auth;
    private readonly api;
    private readonly mapper;
    private readonly invoiceSettings;
    private readonly productsService;
    private readonly logger;
    private creditNoteRangeCache;
    private static readonly NC_RANGE_CACHE_MS;
    constructor(orderRepo: Repository<Order>, customerRepo: Repository<InvoiceCustomer>, standaloneInvoiceRepo: Repository<FactusStandaloneInvoice>, config: ConfigService, auth: FactusAuthService, api: FactusApiClient, mapper: FactusInvoiceMapper, invoiceSettings: FactusInvoiceSettingsService, productsService: ProductsService);
    getStatus(): {
        configured: boolean;
        env: string;
        baseUrl: string;
    };
    lookupCustomer(docType: string, identification: string): Promise<InvoiceCustomerRow | null>;
    searchCustomers(query: string, limit?: number): Promise<InvoiceCustomerRow[]>;
    listCustomersAdmin(page?: number, limit?: number, search?: string): Promise<{
        data: {
            displayName: string;
            createdAt: Date;
            updatedAt: Date;
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
            id: number;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    updateCustomerAdmin(id: number, dto: UpdateInvoiceCustomerDto): Promise<{
        displayName: string;
        createdAt: Date;
        updatedAt: Date;
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
        id: number;
    }>;
    private toInvoiceCustomerDto;
    private normalizeIssueDto;
    issueForOrder(orderId: number, rawDto: IssueElectronicInvoiceDto): Promise<{
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
    previewBulkElectronicInvoices(dto: BulkElectronicInvoicePreviewDto): Promise<{
        catalogSize: number;
        targetTotal: number;
        quantity: number;
        invoices: BulkInvoicePlan[];
        plannedSum: number;
        deviation: number;
        deviationRatio: number;
        withinTolerance: boolean;
        maxDeviationRatio: number;
        message: string;
    }>;
    issueBulkElectronicInvoices(dto: BulkElectronicInvoiceIssueDto): Promise<{
        total: number;
        okCount: number;
        failCount: number;
        results: {
            index: number;
            ok: boolean;
            sum?: number;
            number?: string | null;
            cufe?: string | null;
            publicUrl?: string | null;
            error?: string;
        }[];
    }>;
    findElectronicInvoicesForAdmin(opts: {
        from: string;
        to: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
        exportMode?: boolean;
    }): Promise<{
        from: string;
        to: string;
        page: number;
        limit: number;
        total: number;
        summary: Record<string, number>;
        items: Array<Record<string, unknown>>;
    }>;
    exportElectronicInvoicesCsv(opts: {
        from: string;
        to: string;
        status?: string;
        search?: string;
    }): Promise<{
        filename: string;
        csv: string;
    }>;
    backfillStandaloneInvoicesFromFactus(opts?: {
        limit?: number;
        includeOrderInvoices?: boolean;
    }): Promise<{
        fetched: number;
        candidates: number;
        inserted: number;
        skipped: number;
        items: Array<{
            number: string;
            action: 'inserted' | 'skipped_exists' | 'skipped_not_lote' | 'skipped_order';
            id?: number;
            reason?: string;
        }>;
    }>;
    private parseLoteReferenceCode;
    private parseFactusDateTime;
    private loadBulkCatalogProducts;
}
export {};
