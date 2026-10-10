"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeLikePattern = escapeLikePattern;
exports.invoiceCustomerTextSearchSql = invoiceCustomerTextSearchSql;
exports.applyInvoiceCustomerSearchFilter = applyInvoiceCustomerSearchFilter;
exports.updateInvoiceCustomerRow = updateInvoiceCustomerRow;
const common_1 = require("@nestjs/common");
const factus_customer_utils_1 = require("./factus-customer.utils");
function escapeLikePattern(value) {
    return value.replace(/[%_\\]/g, '\\$&');
}
function invoiceCustomerTextSearchSql(alias = 'c') {
    return `(LOWER(${alias}.names) LIKE LOWER(:pattern) OR LOWER(${alias}.company) LIKE LOWER(:pattern))`;
}
function applyInvoiceCustomerSearchFilter(qb, query, alias = 'c') {
    const q = query.trim();
    if (q.length < 2)
        return;
    const pattern = `%${escapeLikePattern(q)}%`;
    const idDigits = q.replace(/\D/g, '');
    if (idDigits.length >= 3) {
        qb.andWhere(`(${invoiceCustomerTextSearchSql(alias)} OR ${alias}.identification LIKE :idPattern)`, { pattern, idPattern: `%${idDigits}%` });
    }
    else {
        qb.andWhere(invoiceCustomerTextSearchSql(alias), { pattern });
    }
}
async function updateInvoiceCustomerRow(repo, id, dto) {
    const row = await repo.findOne({ where: { id } });
    if (!row) {
        throw new common_1.NotFoundException('Cliente fiscal no encontrado');
    }
    const docType = dto.identificationDocumentCode?.trim() || row.identificationDocumentCode;
    const identification = (dto.identification ?? row.identification).replace(/\D/g, '');
    if (!identification || identification.length < 5) {
        throw new common_1.BadRequestException('Número de documento inválido');
    }
    if (docType !== row.identificationDocumentCode ||
        identification !== row.identification) {
        const clash = await repo.findOne({
            where: { identificationDocumentCode: docType, identification },
        });
        if (clash && clash.id !== id) {
            throw new common_1.ConflictException('Ya existe otro cliente fiscal con ese documento');
        }
    }
    const legalOrg = (0, factus_customer_utils_1.resolveLegalOrganizationFromDocType)(docType);
    row.identificationDocumentCode = docType;
    row.identification = identification;
    row.legalOrganizationCode = legalOrg;
    if (dto.dv !== undefined)
        row.dv = dto.dv?.trim() || null;
    if (dto.names !== undefined)
        row.names = dto.names?.trim() || null;
    if (dto.company !== undefined)
        row.company = dto.company?.trim() || null;
    if (dto.email !== undefined) {
        const mail = dto.email.trim();
        row.email = mail && mail.includes('@') ? mail : null;
    }
    if (dto.phone !== undefined) {
        row.phone = dto.phone?.replace(/\D/g, '').slice(-10) || null;
    }
    if (dto.address !== undefined)
        row.address = dto.address?.trim() || null;
    if (dto.municipalityCode !== undefined) {
        row.municipalityCode = dto.municipalityCode?.trim() || null;
    }
    return repo.save(row);
}
//# sourceMappingURL=factus-invoice-customer.util.js.map