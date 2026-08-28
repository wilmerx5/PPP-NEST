/** 1=jurídica, 2=natural — DIAN/Factus exigen el campo; se infiere del tipo de documento. */
export function resolveLegalOrganizationFromDocType(
  identificationDocumentCode: string,
): '1' | '2' {
  return identificationDocumentCode === '31' ? '1' : '2';
}

export function invoiceCustomerDisplayName(row: {
  names?: string | null;
  company?: string | null;
  identification?: string;
}): string {
  return (row.company || row.names || row.identification || '').trim();
}
