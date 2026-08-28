import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { UpdateInvoiceCustomerDto } from './dto/update-invoice-customer.dto';
import type { InvoiceCustomer } from './entities/invoice-customer.entity';
import { resolveLegalOrganizationFromDocType } from './factus-customer.utils';

/** Escapa comodines LIKE (% y _). Compatible MySQL/MariaDB. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/** Búsqueda case-insensitive sin ILIKE (MySQL no lo soporta). */
export function invoiceCustomerTextSearchSql(alias = 'c'): string {
  return `(LOWER(${alias}.names) LIKE LOWER(:pattern) OR LOWER(${alias}.company) LIKE LOWER(:pattern))`;
}

export function applyInvoiceCustomerSearchFilter(
  qb: ReturnType<Repository<InvoiceCustomer>['createQueryBuilder']>,
  query: string,
  alias = 'c',
): void {
  const q = query.trim();
  if (q.length < 2) return;
  const pattern = `%${escapeLikePattern(q)}%`;
  const idDigits = q.replace(/\D/g, '');
  if (idDigits.length >= 3) {
    qb.andWhere(
      `(${invoiceCustomerTextSearchSql(alias)} OR ${alias}.identification LIKE :idPattern)`,
      { pattern, idPattern: `%${idDigits}%` },
    );
  } else {
    qb.andWhere(invoiceCustomerTextSearchSql(alias), { pattern });
  }
}

export async function updateInvoiceCustomerRow(
  repo: Repository<InvoiceCustomer>,
  id: number,
  dto: UpdateInvoiceCustomerDto,
): Promise<InvoiceCustomer> {
  const row = await repo.findOne({ where: { id } });
  if (!row) {
    throw new NotFoundException('Cliente fiscal no encontrado');
  }

  const docType = dto.identificationDocumentCode?.trim() || row.identificationDocumentCode;
  const identification = (dto.identification ?? row.identification).replace(/\D/g, '');

  if (!identification || identification.length < 5) {
    throw new BadRequestException('Número de documento inválido');
  }

  if (
    docType !== row.identificationDocumentCode ||
    identification !== row.identification
  ) {
    const clash = await repo.findOne({
      where: { identificationDocumentCode: docType, identification },
    });
    if (clash && clash.id !== id) {
      throw new ConflictException('Ya existe otro cliente fiscal con ese documento');
    }
  }

  const legalOrg = resolveLegalOrganizationFromDocType(docType);

  row.identificationDocumentCode = docType;
  row.identification = identification;
  row.legalOrganizationCode = legalOrg;

  if (dto.dv !== undefined) row.dv = dto.dv?.trim() || null;
  if (dto.names !== undefined) row.names = dto.names?.trim() || null;
  if (dto.company !== undefined) row.company = dto.company?.trim() || null;
  if (dto.email !== undefined) {
    const mail = dto.email.trim();
    row.email = mail && mail.includes('@') ? mail : null;
  }
  if (dto.phone !== undefined) {
    row.phone = dto.phone?.replace(/\D/g, '').slice(-10) || null;
  }
  if (dto.address !== undefined) row.address = dto.address?.trim() || null;
  if (dto.municipalityCode !== undefined) {
    row.municipalityCode = dto.municipalityCode?.trim() || null;
  }

  return repo.save(row);
}
