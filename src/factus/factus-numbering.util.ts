import { BadRequestException } from '@nestjs/common';
import type { FactusNumberingRange } from './types/factus.types';

/** Prefijos típicos de nota crédito (sandbox CRTE, prod NC, etc.). */
const NC_PREFIX_RE = /^(NC|CRTE|NCE|NCV|NCP)/i;

/** Documentos DIAN que suelen ser NC (91 = nota crédito en algunos catálogos Factus). */
const NC_DOCUMENT_CODES = new Set(['91', '04', '20']);

export function pickCreditNoteRangeId(
  ranges: FactusNumberingRange[],
  billRangeId?: number,
): number {
  const active = ranges.filter((r) => r.is_active !== false);
  if (!active.length) {
    throw new BadRequestException(
      'No hay rangos de numeración activos en Factus. Configura la resolución en el panel Factus.',
    );
  }

  let candidates = active;
  if (billRangeId && Number.isFinite(billRangeId)) {
    candidates = candidates.filter((r) => r.id !== billRangeId);
  }

  const byPrefix = candidates.filter((r) => r.prefix && NC_PREFIX_RE.test(r.prefix.trim()));
  if (byPrefix.length === 1) return byPrefix[0].id;
  if (byPrefix.length > 1) {
    throw new BadRequestException(
      `Hay varios rangos de nota crédito en Factus (${byPrefix.map((r) => `${r.id}:${r.prefix}`).join(', ')}). ` +
        'Define FACTUS_CREDIT_NOTE_RANGE_ID en el servidor.',
    );
  }

  const byDocName = candidates.filter(
    (r) => r.document && /nota\s*cr[eé]dito/i.test(String(r.document)),
  );
  if (byDocName.length === 1) return byDocName[0].id;

  const byDoc = candidates.filter(
    (r) => r.document && NC_DOCUMENT_CODES.has(String(r.document).trim()),
  );
  if (byDoc.length === 1) return byDoc[0].id;

  if (candidates.length === 1) return candidates[0].id;

  if (candidates.length === 0 && active.length === 1) {
    throw new BadRequestException(
      'Solo hay un rango de numeración (facturas). Falta el rango de nota crédito en Factus/DIAN para poder anular.',
    );
  }

  throw new BadRequestException(
    `No se pudo detectar el rango de nota crédito automáticamente. Rangos disponibles: ${active
      .map((r) => `${r.id} (${r.prefix || 'sin prefijo'}, doc ${r.document || '?'})`)
      .join('; ')}. Define FACTUS_CREDIT_NOTE_RANGE_ID.`,
  );
}

export function pickBillRangeId(ranges: FactusNumberingRange[]): number | undefined {
  const active = ranges.filter((r) => r.is_active !== false);
  const byDocName = active.filter(
    (r) => r.document && /factura\s*de\s*venta/i.test(String(r.document)),
  );
  if (byDocName.length === 1) return byDocName[0].id;
  if (active.length === 1) return active[0].id;
  const bills = active.filter(
    (r) => !r.prefix || !NC_PREFIX_RE.test(r.prefix.trim()),
  );
  const saleBills = bills.filter(
    (r) => !r.document || !/nota/i.test(String(r.document)),
  );
  if (saleBills.length === 1) return saleBills[0].id;
  if (bills.length === 1) return bills[0].id;
  return undefined;
}
