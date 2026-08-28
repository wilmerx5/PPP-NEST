import { CancelElectronicInvoiceDto, ResendElectronicInvoiceEmailDto } from './dto/factus-actions.dto';
import { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import { FactusService } from './factus.service';
export declare class FactusController {
    private readonly factusService;
    constructor(factusService: FactusService);
    getStatus(): {
        configured: boolean;
        env: string;
        baseUrl: string;
    };
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
