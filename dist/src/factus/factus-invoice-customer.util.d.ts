import { Repository } from 'typeorm';
import type { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import type { InvoiceCustomer } from './entities/invoice-customer.entity';
export declare function escapeLikePattern(value: string): string;
export declare function invoiceCustomerTextSearchSql(alias?: string): string;
export declare function applyInvoiceCustomerSearchFilter(qb: ReturnType<Repository<InvoiceCustomer>['createQueryBuilder']>, query: string, alias?: string): void;
export declare function updateInvoiceCustomerRow(repo: Repository<InvoiceCustomer>, id: number, dto: UpdateInvoiceCustomerDto): Promise<InvoiceCustomer>;
