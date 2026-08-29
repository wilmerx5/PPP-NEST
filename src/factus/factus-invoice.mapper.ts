import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/entities/order.entity';
import type { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import type { InvoiceCustomer } from './entities/invoice-customer.entity';
import type { ResolvedFactusTaxConfig } from './factus-invoice-settings.types';
import { resolveLegalOrganizationFromDocType } from './factus-customer.utils';
import type {
  FactusBillDetail,
  FactusBillItem,
  FactusCustomer,
  FactusItemTax,
  FactusValidateBillRequest,
  FactusValidateCreditNoteRequest,
} from './types/factus.types';

/** Formatea número a string con 2 decimales (requerido por Factus). */
export function factusMoney(n: number): string {
  return factusRound2(n).toFixed(2);
}

/** Redondeo bancario a 2 decimales (como Factus/DIAN en líneas). */
export function factusRound2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Total de factura alineado con Factus: por línea
 * neto = round(qty * price, 2), impuesto = round(neto * rate/100, 2).
 * Evita payment_details 49,999.99 vs total 50,000.00.
 */
export function factusInvoiceTotalFromItems(
  items: Array<{
    quantity: string;
    price: string;
    taxes?: Array<{ rate?: string; is_excluded?: boolean }>;
  }>,
): number {
  let sum = 0;
  for (const i of items) {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.price) || 0;
    const lineNet = factusRound2(qty * price);
    let tax = 0;
    for (const t of i.taxes || []) {
      const rate = parseFloat(t.rate || '0') || 0;
      if (!t.is_excluded && rate > 0) {
        tax = factusRound2(tax + factusRound2(lineNet * (rate / 100)));
      }
    }
    sum = factusRound2(sum + lineNet + tax);
  }
  return sum;
}

const FACTUS_TZ = 'America/Bogota';

/** YYYY-MM-DD en zona Colombia (nunca usa UTC puro). */
export function formatYmdInTimeZone(
  date: Date,
  timeZone: string = FACTUS_TZ,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Fecha de pedido para Factus order_reference.issue_date.
 * Clampa a "hoy" en Bogotá si por UTC el día ya avanzó.
 */
export function factusOrderIssueDateYmd(
  d: Date | string | undefined,
  now: Date = new Date(),
): string {
  const date = d ? new Date(d) : now;
  const bogota = formatYmdInTimeZone(date, FACTUS_TZ);
  const todayBogota = formatYmdInTimeZone(now, FACTUS_TZ);
  return bogota > todayBogota ? todayBogota : bogota;
}

@Injectable()
export class FactusInvoiceMapper {
  constructor(private readonly config: ConfigService) {}

  /**
   * Arma el body POST /v2/bills/validate desde una orden PPP + datos del modal.
   * PPP es la fuente de verdad de ítems/totales; el DTO completa el adquiriente DIAN.
   */
  buildValidatePayload(
    order: Order,
    dto: IssueElectronicInvoiceDto,
    taxConfig: ResolvedFactusTaxConfig,
  ): { payload: FactusValidateBillRequest; invoiceTotal: number } {
    const allItems = [
      ...this.mapItems(order, taxConfig),
      ...this.deliveryAsExtra(order, taxConfig),
      ...this.mapExtras(order, taxConfig),
    ];
    // Total como Factus (redondeo por línea) — payment_details debe coincidir exacto
    const total = factusInvoiceTotalFromItems(allItems);

    const paymentMethod =
      (dto.paymentMethodCode || this.config.get<string>('FACTUS_DEFAULT_PAYMENT_METHOD') || '10').trim();

    const rangeRaw = this.config.get<string>('FACTUS_NUMBERING_RANGE_ID');
    const numberingRangeId = rangeRaw ? parseInt(rangeRaw, 10) : undefined;

    const municipality =
      (dto.municipalityCode ||
        this.config.get<string>('FACTUS_DEFAULT_MUNICIPALITY_CODE') ||
        '11001').trim();

    const legalOrganizationCode =
      dto.legalOrganizationCode ||
      resolveLegalOrganizationFromDocType(dto.identificationDocumentCode);

    const customerNames =
      legalOrganizationCode === '2'
        ? (dto.names || order.customerName || 'Consumidor final').trim()
        : undefined;
    const customerCompany =
      legalOrganizationCode === '1'
        ? (dto.company || order.customerName || 'Cliente').trim()
        : undefined;

    const payload: FactusValidateBillRequest = {
      reference_code: `PPP-ORD-${order.id}`,
      document: '01',
      operation_type: '10',
      send_email: dto.sendEmail !== false,
      observation: (dto.observation || `Pedido #${order.dailyOrderNumber ?? order.id}`).slice(0, 250),
      cash_rounding_amount: '0.00',
      payment_details: [
        {
          payment_form: '1',
          payment_method_code: paymentMethod,
          reference_code: `order-${order.id}`,
          amount: factusMoney(total),
        },
      ],
      customer: {
        identification_document_code: dto.identificationDocumentCode,
        identification: dto.identification.replace(/\D/g, ''),
        dv: dto.dv,
        legal_organization_code: legalOrganizationCode,
        tribute_code: 'ZZ',
        responsibilities: ['R-99-PN'],
        names: customerNames,
        company: customerCompany,
        address: (dto.address || order.address || '').trim() || undefined,
        email: (dto.email || order.customerEmail || '').trim() || undefined,
        phone: (dto.phone || order.phone || '').replace(/\D/g, '').slice(-10) || undefined,
        country_code: 'CO',
        municipality_code: municipality,
      },
      items: allItems,
      order_reference: {
        reference_code: String(order.dailyOrderNumber ?? order.id),
        issue_date: factusOrderIssueDateYmd(order.createdAt),
      },
    };

    if (Number.isFinite(numberingRangeId) && numberingRangeId! > 0) {
      payload.numbering_range_id = numberingRangeId;
    }

    return { payload, invoiceTotal: total };
  }

  /**
   * Nota crédito de anulación total sobre la FE ya emitida (mismos ítems/total).
   */
  buildCreditNotePayload(
    order: Order,
    opts: {
      observation?: string;
      correctionConceptCode?: string;
      savedCustomer?: InvoiceCustomer | null;
      numberingRangeId: number;
      taxConfig: ResolvedFactusTaxConfig;
    },
  ): FactusValidateCreditNoteRequest {
    if (!order.electronicInvoiceNumber) {
      throw new BadRequestException('La orden no tiene número de factura electrónica');
    }

    if (!Number.isFinite(opts.numberingRangeId) || opts.numberingRangeId <= 0) {
      throw new BadRequestException('Rango de nota crédito inválido');
    }

    const allItems = [
      ...this.mapItems(order, opts.taxConfig),
      ...this.deliveryAsExtra(order, opts.taxConfig),
      ...this.mapExtras(order, opts.taxConfig),
    ];
    const total = factusInvoiceTotalFromItems(allItems);
    const paymentMethod =
      (this.config.get<string>('FACTUS_DEFAULT_PAYMENT_METHOD') || '10').trim();

    const payload: FactusValidateCreditNoteRequest = {
      reference_code: `PPP-NC-${order.id}-${Date.now()}`,
      correction_concept_code: (opts.correctionConceptCode || '2').trim(),
      customization_id: '20',
      bill_number: order.electronicInvoiceNumber,
      numbering_range_id: opts.numberingRangeId,
      observation: (
        opts.observation ||
        `Anulación FE ${order.electronicInvoiceNumber} — pedido #${order.dailyOrderNumber ?? order.id}`
      ).slice(0, 250),
      payment_details: [
        {
          payment_form: '1',
          payment_method_code: paymentMethod,
          reference_code: `nc-order-${order.id}`,
          amount: factusMoney(total),
        },
      ],
      customer: this.buildCreditNoteCustomer(order, opts.savedCustomer),
      items: allItems,
    };

    return payload;
  }

  /** Mapea el cliente de GET /v2/bills/:number al formato POST /v2/credit-notes/validate. */
  customerFromBillDetail(bill: FactusBillDetail): FactusCustomer {
    const c = bill.customer;
    if (!c?.identification?.trim()) {
      throw new BadRequestException(
        'Factus no devolvió el documento del cliente en la factura original',
      );
    }

    const identification = c.identification.replace(/\D/g, '');
    const docType = c.identification_document?.code?.trim() || '13';
    const legalOrg =
      c.legal_organization?.code?.trim() ||
      (docType === '31' ? '1' : '2');

    let responsibilities: string[] = [];
    if (Array.isArray(c.responsibilities)) {
      responsibilities = c.responsibilities
        .map((r) => (typeof r === 'string' ? r : r.code || ''))
        .map((code) => code.trim())
        .filter(Boolean);
    }
    if (!responsibilities.length) {
      responsibilities = ['R-99-PN'];
    }

    const names =
      legalOrg === '2'
        ? (c.names || c.graphic_representation_name || 'Consumidor final').trim()
        : undefined;
    const company =
      legalOrg === '1'
        ? (c.company || c.trade_name || c.graphic_representation_name || 'Cliente').trim()
        : undefined;

    return {
      identification_document_code: docType,
      identification,
      dv: c.dv?.trim() || undefined,
      legal_organization_code: legalOrg,
      tribute_code: c.tribute?.code?.trim() || 'ZZ',
      responsibilities,
      names,
      company,
      address: c.address?.trim() || undefined,
      email: c.email?.trim() || undefined,
      phone: c.phone?.replace(/\D/g, '').slice(-10) || undefined,
      country_code: c.country?.code?.trim() || 'CO',
      municipality_code: c.municipality?.code?.trim() || '11001',
    };
  }

  /** Cliente adquiriente para NC — Factus lo exige aunque exista bill_number. */
  private buildCreditNoteCustomer(
    order: Order,
    saved?: InvoiceCustomer | null,
  ): FactusCustomer {
    const docType =
      saved?.identificationDocumentCode ||
      order.invoiceCustomerDocType ||
      '13';
    const identification = (
      saved?.identification ||
      order.invoiceCustomerDocNumber ||
      ''
    ).replace(/\D/g, '');

    if (identification.length < 5) {
      throw new BadRequestException(
        'No hay documento del cliente en la orden. Emite de nuevo la FE o contacta soporte.',
      );
    }

    const legalOrg =
      saved?.legalOrganizationCode ||
      (docType === '31' ? '1' : '2');
    const municipality =
      saved?.municipalityCode ||
      this.config.get<string>('FACTUS_DEFAULT_MUNICIPALITY_CODE') ||
      '11001';

    const names =
      legalOrg === '2'
        ? (saved?.names || order.customerName || 'Consumidor final').trim()
        : undefined;
    const company =
      legalOrg === '1'
        ? (saved?.company || order.customerName || 'Cliente').trim()
        : undefined;

    return {
      identification_document_code: docType,
      identification,
      dv: saved?.dv || order.invoiceCustomerDocDv || undefined,
      legal_organization_code: legalOrg,
      tribute_code: 'ZZ',
      responsibilities: ['R-99-PN'],
      names,
      company,
      address: (saved?.address || order.address || '').trim() || undefined,
      email: (saved?.email || order.customerEmail || '').trim() || undefined,
      phone: (saved?.phone || order.phone || '').replace(/\D/g, '').slice(-10) || undefined,
      country_code: 'CO',
      municipality_code: municipality,
    };
  }

  private combinedTaxRatePercent(taxConfig: ResolvedFactusTaxConfig): number {
    return taxConfig.taxes
      .filter((t) => !t.isExcluded && t.rate > 0)
      .reduce((sum, t) => sum + t.rate, 0);
  }

  /** Precio unitario neto para Factus (`price` = sin impuesto). */
  private netUnitPrice(grossUnit: number, taxConfig: ResolvedFactusTaxConfig): number {
    const totalRate = this.combinedTaxRatePercent(taxConfig);
    if (taxConfig.pricesIncludeTax && totalRate > 0) {
      const gross = factusRound2(grossUnit);
      // Neto a 2 decimales; si neto+IVA redondeado ≠ gross, ajustar 1 centavo
      let net = factusRound2(gross / (1 + totalRate / 100));
      let tax = factusRound2(net * (totalRate / 100));
      let got = factusRound2(net + tax);
      if (got !== gross) {
        net = factusRound2(net + (gross - got));
        tax = factusRound2(net * (totalRate / 100));
        got = factusRound2(net + tax);
        // Si aún no cierra (raro), dejar el neto estándar; payment usará total Factus
        if (got !== gross) {
          net = factusRound2(gross / (1 + totalRate / 100));
        }
      }
      return net;
    }
    return factusRound2(grossUnit);
  }

  private buildItemTaxes(taxConfig: ResolvedFactusTaxConfig): FactusItemTax[] {
    return taxConfig.taxes.map((t) => ({
      code: t.code,
      rate: factusMoney(t.rate),
      ...(t.isExcluded ? { is_excluded: true } : {}),
    }));
  }

  private toFactusBillItem(
    params: {
      code_reference: string;
      name: string;
      quantity: number;
      grossUnit: number;
      note?: string;
    },
    taxConfig: ResolvedFactusTaxConfig,
  ): FactusBillItem {
    return {
      code_reference: params.code_reference,
      name: params.name.slice(0, 200),
      quantity: factusMoney(params.quantity),
      discount_rate: '0.00',
      price: factusMoney(this.netUnitPrice(params.grossUnit, taxConfig)),
      unit_measure_code: '94',
      standard_code: '999',
      note: params.note,
      taxes: this.buildItemTaxes(taxConfig),
    };
  }

  private mapItems(order: Order, taxConfig: ResolvedFactusTaxConfig): FactusBillItem[] {
    const grouped = new Map<
      string,
      { code: string; name: string; qty: number; unit: number; note?: string }
    >();

    for (const item of order.items || []) {
      if (!item.product) continue;
      const unitRaw =
        item.unitPrice != null && item.unitPrice !== ('' as never)
          ? Number(item.unitPrice)
          : Number(item.product.price ?? 0);
      const key = `${item.product.code}|${unitRaw}|${(item.note || '').trim()}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.qty += 1;
      } else {
        grouped.set(key, {
          code: String(item.product.code),
          name: item.product.name,
          qty: 1,
          unit: unitRaw,
          note: item.note?.trim() || undefined,
        });
      }
    }

    return [...grouped.values()].map((g) =>
      this.toFactusBillItem(
        {
          code_reference: g.code,
          name: g.name,
          quantity: g.qty,
          grossUnit: g.unit,
          note: g.note,
        },
        taxConfig,
      ),
    );
  }

  private mapExtras(order: Order, taxConfig: ResolvedFactusTaxConfig): FactusBillItem[] {
    return (order.extras || []).map((ex, idx) =>
      this.toFactusBillItem(
        {
          code_reference: `EXTRA-${ex.id ?? idx}`,
          name: ex.title || 'Adicional',
          quantity: ex.quantity ?? 1,
          grossUnit: Number(ex.amount) || 0,
          note: ex.description || undefined,
        },
        taxConfig,
      ),
    );
  }

  private deliveryAsExtra(order: Order, taxConfig: ResolvedFactusTaxConfig): FactusBillItem[] {
    const fee = Number(order.deliveryFee) || 0;
    if (fee <= 0 || order.orderType !== 'delivery') return [];
    return [
      this.toFactusBillItem(
        {
          code_reference: 'DELIVERY',
          name: 'Domicilio',
          quantity: 1,
          grossUnit: fee,
        },
        taxConfig,
      ),
    ];
  }
}
