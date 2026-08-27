"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusInvoiceMapper = void 0;
exports.factusMoney = factusMoney;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
function factusMoney(n) {
    return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}
let FactusInvoiceMapper = class FactusInvoiceMapper {
    config;
    constructor(config) {
        this.config = config;
    }
    buildValidatePayload(order, dto) {
        const items = this.mapItems(order);
        const invoiceTotal = this.sumItemsGross(items) + this.deliveryAsExtra(order).reduce((s, i) => {
            const qty = parseFloat(i.quantity);
            const price = parseFloat(i.price);
            return s + qty * price;
        }, 0);
        const allItems = [...items, ...this.deliveryAsExtra(order), ...this.mapExtras(order)];
        const total = this.sumItemsGross(allItems);
        const paymentMethod = (dto.paymentMethodCode || this.config.get('FACTUS_DEFAULT_PAYMENT_METHOD') || '10').trim();
        const rangeRaw = this.config.get('FACTUS_NUMBERING_RANGE_ID');
        const numberingRangeId = rangeRaw ? parseInt(rangeRaw, 10) : undefined;
        const municipality = (dto.municipalityCode ||
            this.config.get('FACTUS_DEFAULT_MUNICIPALITY_CODE') ||
            '11001').trim();
        const customerNames = dto.legalOrganizationCode === '2'
            ? (dto.names || order.customerName || 'Consumidor final').trim()
            : undefined;
        const customerCompany = dto.legalOrganizationCode === '1'
            ? (dto.company || order.customerName || 'Cliente').trim()
            : undefined;
        const payload = {
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
        if (Number.isFinite(numberingRangeId) && numberingRangeId > 0) {
            payload.numbering_range_id = numberingRangeId;
        }
        return { payload, invoiceTotal: total };
    }
    mapItems(order) {
        const taxCode = this.config.get('FACTUS_ITEM_TAX_CODE') || '01';
        const taxRate = this.config.get('FACTUS_ITEM_TAX_RATE') || '0.00';
        const excluded = (this.config.get('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
            'true';
        const pricesIncludeTax = (this.config.get('FACTUS_PRICES_INCLUDE_TAX') || 'true').toLowerCase() ===
            'true';
        const rateNum = parseFloat(taxRate) || 0;
        const grouped = new Map();
        for (const item of order.items || []) {
            if (!item.product)
                continue;
            const unitRaw = item.unitPrice != null && item.unitPrice !== ''
                ? Number(item.unitPrice)
                : Number(item.product.price ?? 0);
            const key = `${item.product.code}|${unitRaw}|${(item.note || '').trim()}`;
            const prev = grouped.get(key);
            if (prev) {
                prev.qty += 1;
            }
            else {
                grouped.set(key, {
                    code: String(item.product.code),
                    name: item.product.name,
                    qty: 1,
                    unit: unitRaw,
                    note: item.note?.trim() || undefined,
                });
            }
        }
        const out = [];
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
    mapExtras(order) {
        const taxCode = this.config.get('FACTUS_ITEM_TAX_CODE') || '01';
        const taxRate = this.config.get('FACTUS_ITEM_TAX_RATE') || '0.00';
        const excluded = (this.config.get('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
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
    deliveryAsExtra(order) {
        const fee = Number(order.deliveryFee) || 0;
        if (fee <= 0 || order.orderType !== 'delivery')
            return [];
        const taxCode = this.config.get('FACTUS_ITEM_TAX_CODE') || '01';
        const taxRate = this.config.get('FACTUS_ITEM_TAX_RATE') || '0.00';
        const excluded = (this.config.get('FACTUS_ITEM_TAX_EXCLUDED') || 'true').toLowerCase() ===
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
    sumItemsGross(items) {
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
    toYmd(d) {
        const date = d ? new Date(d) : new Date();
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
};
exports.FactusInvoiceMapper = FactusInvoiceMapper;
exports.FactusInvoiceMapper = FactusInvoiceMapper = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FactusInvoiceMapper);
//# sourceMappingURL=factus-invoice.mapper.js.map