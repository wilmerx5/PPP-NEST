import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/entities/order.entity';
import type { IssueElectronicInvoiceDto } from './dto/issue-electronic-invoice.dto';
import type {
  FactusBillItem,
  FactusValidateBillRequest,
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

  private mapItems(order: Order): FactusBillItem[] {
    const taxCode = this.config.get<string>('FACTUS_ITEM_TAX_CODE') || '01';
    const taxRate = this.config.get<string>('FACTUS_ITEM_TAX_RATE') || '0.00';
    const excluded =
      (this.config.get<string>('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
      'true';
    const pricesIncludeTax =
      (this.config.get<string>('FACTUS_PRICES_INCLUDE_TAX') || 'true').toLowerCase() ===
      'true';
    const rateNum = parseFloat(taxRate) || 0;

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

    const out: FactusBillItem[] = [];
    for (const g of grouped.values()) {
      let unitPrice = g.unit;
      if (pricesIncludeTax && rateNum > 0 && !excluded) {
        unitPrice = unitPrice / (1 + rateNum / 100);
      }
      out.push({
        code_reference: g.code,
        name: g.name.slice(0, 200),
        quantity: factusMoney(g.qty),
        discount_rate: '0.00',
        price: factusMoney(unitPrice),
        unit_measure_code: '94',
        standard_code: '999',
        note: g.note,
        taxes: [
          {
            code: taxCode,
            rate: factusMoney(rateNum),
            ...(excluded ? { is_excluded: true } : {}),
          },
        ],
      });
    }
    return out;
  }

  private mapExtras(order: Order): FactusBillItem[] {
    const taxCode = this.config.get<string>('FACTUS_ITEM_TAX_CODE') || '01';
    const taxRate = this.config.get<string>('FACTUS_ITEM_TAX_RATE') || '0.00';
    const excluded =
      (this.config.get<string>('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
      'true';
    const rateNum = parseFloat(taxRate) || 0;

    return (order.extras || []).map((ex, idx) => ({
      code_reference: `EXTRA-${ex.id ?? idx}`,
      name: (ex.title || 'Adicional').slice(0, 200),
      quantity: factusMoney(ex.quantity ?? 1),
      discount_rate: '0.00',
      price: factusMoney(Number(ex.amount) || 0),
      unit_measure_code: '94',
      standard_code: '999',
      note: ex.description || undefined,
      taxes: [
        {
          code: taxCode,
          rate: factusMoney(rateNum),
          ...(excluded ? { is_excluded: true } : {}),
        },
      ],
    }));
  }

  private deliveryAsExtra(order: Order): FactusBillItem[] {
    const fee = Number(order.deliveryFee) || 0;
    if (fee <= 0 || order.orderType !== 'delivery') return [];
    const taxCode = this.config.get<string>('FACTUS_ITEM_TAX_CODE') || '01';
    const taxRate = this.config.get<string>('FACTUS_ITEM_TAX_RATE') || '0.00';
    const excluded =
      (this.config.get<string>('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
      'true';
    const rateNum = parseFloat(taxRate) || 0;
    return [
      {
        code_reference: 'DELIVERY',
        name: 'Domicilio',
        quantity: '1.00',
        discount_rate: '0.00',
        price: factusMoney(fee),
        unit_measure_code: '94',
        standard_code: '999',
        taxes: [
          {
            code: taxCode,
            rate: factusMoney(rateNum),
            ...(excluded ? { is_excluded: true } : {}),
          },
        ],
      },
    ];
  }

  private sumItemsGross(items: FactusBillItem[]): number {
    return items.reduce((sum, i) => {
      const qty = parseFloat(i.quantity) || 0;
      const price = parseFloat(i.price) || 0;
      const rate = parseFloat(i.taxes?.[0]?.rate || '0') || 0;
      const excluded = !!i.taxes?.[0]?.is_excluded;
      const line = qty * price;
      const tax = excluded || rate <= 0 ? 0 : line * (rate / 100);
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
