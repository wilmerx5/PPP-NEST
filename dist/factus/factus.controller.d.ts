import { CancelElectronicInvoiceDto, ResendElectronicInvoiceEmailDto } from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { BulkElectronicInvoiceIssueDto, BulkElectronicInvoicePreviewDto } from './dto/bulk-electronic-invoice.dto';
import { UpdateFactusInvoiceSettingsDto } from './dto/factus-invoice-settings.dto';
import { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import { FactusService } from './factus.service';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';
export declare class FactusController {
    private readonly factusService;
    private readonly invoiceSettings;
    constructor(factusService: FactusService, invoiceSettings: FactusInvoiceSettingsService);
    getStatus(): {
        configured: boolean;
        env: string;
        baseUrl: string;
    };
    getInvoiceSettings(): Promise<import("./factus-invoice-settings.types").FactusInvoiceSettingsResponse>;
    updateInvoiceSettings(dto: UpdateFactusInvoiceSettingsDto): Promise<import("./factus-invoice-settings.types").FactusInvoiceSettingsResponse>;
    searchCustomers(q: string, limit?: string): Promise<{
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
    }[]>;
    listCustomersAdmin(page?: string, limit?: string, search?: string): Promise<{
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
    previewBulkInvoices(dto: BulkElectronicInvoicePreviewDto): Promise<{
        catalogSize: number;
        targetTotal: number;
        quantity: number;
        invoices: import("./factus-bulk-select.util").BulkInvoicePlan[];
        plannedSum: number;
        deviation: number;
        deviationRatio: number;
        withinTolerance: boolean;
        maxDeviationRatio: number;
        message: string;
    }>;
    issueBulkInvoices(dto: BulkElectronicInvoiceIssueDto): Promise<{
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
    backfillStandaloneInvoices(limit?: string, includeOrderInvoices?: string): Promise<{
        fetched: number;
        candidates: number;
        inserted: number;
        skipped: number;
        items: Array<{
            number: string;
            action: "inserted" | "skipped_exists" | "skipped_not_lote" | "skipped_order";
            id?: number;
            reason?: string;
        }>;
    }>;
    lookupCustomer(identificationDocumentCode: string, identification: string): Promise<{
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
    } | null>;
    issueInvoice(id: number, dto: IssueElectronicInvoiceDto): Promise<{
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
    downloadPdf(id: number): Promise<import("@nestjs/common").StreamableFile>;
    resendEmail(id: number, dto: ResendElectronicInvoiceEmailDto): Promise<{
        success: boolean;
        orderId: number;
        number: string | null;
        email: string;
        message: string;
    }>;
    cancelInvoice(id: number, dto: CancelElectronicInvoiceDto): Promise<{
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
}
