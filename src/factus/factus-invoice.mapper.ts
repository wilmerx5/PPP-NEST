import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/entities/order.entity';
import type { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import type { InvoiceCustomer } from './entities/invoice-customer.entity';
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
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
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
  ): { payload: FactusValidateBillRequest; invoiceTotal: number } {
    const items = this.mapItems(order);
    const invoiceTotal = this.sumItemsGross(items) + this.deliveryAsExtra(order).reduce((s, i) => {
      const qty = parseFloat(i.quantity);
      const price = parseFloat(i.price);
      return s + qty * price;
    }, 0);

    // delivery ya va en items si aplica
    const allItems = [...items, ...this.deliveryAsExtra(order), ...this.mapExtras(order)];
    const total = this.sumItemsGross(allItems);

    const paymentMethod =
      (dto.paymentMethodCode || this.config.get<string>('FACTUS_DEFAULT_PAYMENT_METHOD') || '10').trim();

    const rangeRaw = this.config.get<string>('FACTUS_NUMBERING_RANGE_ID');
    const numberingRangeId = rangeRaw ? parseInt(rangeRaw, 10) : undefined;

    const municipality =
      (dto.municipalityCode ||
        this.config.get<string>('FACTUS_DEFAULT_MUNICIPALITY_CODE') ||
        '11001').trim();

    const customerNames =
      dto.legalOrganizationCode === '2'
        ? (dto.names || order.customerName || 'Consumidor final').trim()
        : undefined;
    const customerCompany =
      dto.legalOrganizationCode === '1'
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
        legal_organization_code: dto.legalOrganizationCode,
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
        issue_date: this.toYmd(order.createdAt),
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
    },
  ): FactusValidateCreditNoteRequest {
    if (!order.electronicInvoiceNumber) {
      throw new BadRequestException('La orden no tiene número de factura electrónica');
    }

    if (!Number.isFinite(opts.numberingRangeId) || opts.numberingRangeId <= 0) {
      throw new BadRequestException('Rango de nota crédito inválido');
    }

    const allItems = [
      ...this.mapItems(order),
      ...this.deliveryAsExtra(order),
      ...this.mapExtras(order),
    ];
    const total = this.sumItemsGross(allItems);
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

  private getItemTaxConfig() {
    // Restaurantes Colombia: INC (impoconsumo) = código Factus/DIAN `04`, tarifa 8%
    const taxCode = this.config.get<string>('FACTUS_ITEM_TAX_CODE') || '04';
    const taxRate = this.config.get<string>('FACTUS_ITEM_TAX_RATE') || '8.00';
    const excluded =
      (this.config.get<string>('FACTUS_ITEM_TAX_EXCLUDED') || 'false').toLowerCase() ===
      'true';
    const pricesIncludeTax =
      (this.config.get<string>('FACTUS_PRICES_INCLUDE_TAX') || 'true').toLowerCase() ===
      'true';
    const rateNum = parseFloat(taxRate) || 0;
    return { taxCode, excluded, pricesIncludeTax, rateNum };
  }

  /** Precio unitario neto para Factus (`price` = sin impuesto). */
  private netUnitPrice(
    grossUnit: number,
    cfg: ReturnType<FactusInvoiceMapper['getItemTaxConfig']>,
  ): number {
    if (cfg.pricesIncludeTax && cfg.rateNum > 0 && !cfg.excluded) {
      return grossUnit / (1 + cfg.rateNum / 100);
    }
    return grossUnit;
  }

  private buildItemTaxes(
    cfg: ReturnType<FactusInvoiceMapper['getItemTaxConfig']>,
  ): FactusItemTax[] {
    return [
      {
        code: cfg.taxCode,
        rate: factusMoney(cfg.rateNum),
        ...(cfg.excluded ? { is_excluded: true } : {}),
      },
    ];
  }

  private toFactusBillItem(params: {
    code_reference: string;
    name: string;
    quantity: number;
    grossUnit: number;
    note?: string;
  }): FactusBillItem {
    const cfg = this.getItemTaxConfig();
    return {
      code_reference: params.code_reference,
      name: params.name.slice(0, 200),
      quantity: factusMoney(params.quantity),
      discount_rate: '0.00',
      price: factusMoney(this.netUnitPrice(params.grossUnit, cfg)),
      unit_measure_code: '94',
      standard_code: '999',
      note: params.note,
      taxes: this.buildItemTaxes(cfg),
    };
  }

  private mapItems(order: Order): FactusBillItem[] {
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
      this.toFactusBillItem({
        code_reference: g.code,
        name: g.name,
        quantity: g.qty,
        grossUnit: g.unit,
        note: g.note,
      }),
    );
  }

  private mapExtras(order: Order): FactusBillItem[] {
    return (order.extras || []).map((ex, idx) =>
      this.toFactusBillItem({
        code_reference: `EXTRA-${ex.id ?? idx}`,
        name: ex.title || 'Adicional',
        quantity: ex.quantity ?? 1,
        grossUnit: Number(ex.amount) || 0,
        note: ex.description || undefined,
      }),
    );
  }

  private deliveryAsExtra(order: Order): FactusBillItem[] {
    const fee = Number(order.deliveryFee) || 0;
    if (fee <= 0 || order.orderType !== 'delivery') return [];
    return [
      this.toFactusBillItem({
        code_reference: 'DELIVERY',
        name: 'Domicilio',
        quantity: 1,
        grossUnit: fee,
      }),
    ];
  }

  private sumItemsGross(items: FactusBillItem[]): number {
    return items.reduce((sum, i) => {
      const qty = parseFloat(i.quantity) || 0;
      const price = parseFloat(i.price) || 0;
      const line = qty * price;
      let tax = 0;
      for (const t of i.taxes || []) {
        const rate = parseFloat(t.rate || '0') || 0;
        if (!t.is_excluded && rate > 0) tax += line * (rate / 100);
      }
      return sum + line + tax;
    }, 0);
  }

  private toYmd(d: Date | string | undefined): string {
    const date = d ? new Date(d) : new Date();
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
