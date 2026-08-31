"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLegalOrganizationFromDocType = resolveLegalOrganizationFromDocType;
exports.invoiceCustomerDisplayName = invoiceCustomerDisplayName;
function resolveLegalOrganizationFromDocType(identificationDocumentCode) {
    return identificationDocumentCode === '31' ? '1' : '2';
}
function invoiceCustomerDisplayName(row) {
    return (row.company || row.names || row.identification || '').trim();
}
//# sourceMappingURL=factus-customer.utils.js.map