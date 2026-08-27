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
}
