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
    buildValidatePayload(order, dto, taxConfig) {
        const allItems = [
            ...this.mapItems(order, taxConfig),
            ...this.deliveryAsExtra(order, taxConfig),
            ...this.mapExtras(order, taxConfig),
        ];
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
    buildCreditNotePayload(order, opts) {
        if (!order.electronicInvoiceNumber) {
            throw new common_1.BadRequestException('La orden no tiene número de factura electrónica');
        }
        if (!Number.isFinite(opts.numberingRangeId) || opts.numberingRangeId <= 0) {
            throw new common_1.BadRequestException('Rango de nota crédito inválido');
        }
        const allItems = [
            ...this.mapItems(order, opts.taxConfig),
            ...this.deliveryAsExtra(order, opts.taxConfig),
            ...this.mapExtras(order, opts.taxConfig),
        ];
        const total = this.sumItemsGross(allItems);
        const paymentMethod = (this.config.get('FACTUS_DEFAULT_PAYMENT_METHOD') || '10').trim();
        const payload = {
            reference_code: `PPP-NC-${order.id}-${Date.now()}`,
            correction_concept_code: (opts.correctionConceptCode || '2').trim(),
            customization_id: '20',
            bill_number: order.electronicInvoiceNumber,
            numbering_range_id: opts.numberingRangeId,
            observation: (opts.observation ||
                `Anulación FE ${order.electronicInvoiceNumber} — pedido #${order.dailyOrderNumber ?? order.id}`).slice(0, 250),
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
    customerFromBillDetail(bill) {
        const c = bill.customer;
        if (!c?.identification?.trim()) {
            throw new common_1.BadRequestException('Factus no devolvió el documento del cliente en la factura original');
        }
        const identification = c.identification.replace(/\D/g, '');
        const docType = c.identification_document?.code?.trim() || '13';
        const legalOrg = c.legal_organization?.code?.trim() ||
            (docType === '31' ? '1' : '2');
        let responsibilities = [];
        if (Array.isArray(c.responsibilities)) {
            responsibilities = c.responsibilities
                .map((r) => (typeof r === 'string' ? r : r.code || ''))
                .map((code) => code.trim())
                .filter(Boolean);
        }
        if (!responsibilities.length) {
            responsibilities = ['R-99-PN'];
        }
        const names = legalOrg === '2'
            ? (c.names || c.graphic_representation_name || 'Consumidor final').trim()
            : undefined;
        const company = legalOrg === '1'
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
    buildCreditNoteCustomer(order, saved) {
        const docType = saved?.identificationDocumentCode ||
            order.invoiceCustomerDocType ||
            '13';
        const identification = (saved?.identification ||
            order.invoiceCustomerDocNumber ||
            '').replace(/\D/g, '');
        if (identification.length < 5) {
            throw new common_1.BadRequestException('No hay documento del cliente en la orden. Emite de nuevo la FE o contacta soporte.');
        }
        const legalOrg = saved?.legalOrganizationCode ||
            (docType === '31' ? '1' : '2');
        const municipality = saved?.municipalityCode ||
            this.config.get('FACTUS_DEFAULT_MUNICIPALITY_CODE') ||
            '11001';
        const names = legalOrg === '2'
            ? (saved?.names || order.customerName || 'Consumidor final').trim()
            : undefined;
        const company = legalOrg === '1'
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
    combinedTaxRatePercent(taxConfig) {
        return taxConfig.taxes
            .filter((t) => !t.isExcluded && t.rate > 0)
            .reduce((sum, t) => sum + t.rate, 0);
    }
    netUnitPrice(grossUnit, taxConfig) {
        const totalRate = this.combinedTaxRatePercent(taxConfig);
        if (taxConfig.pricesIncludeTax && totalRate > 0) {
            return grossUnit / (1 + totalRate / 100);
        }
        return grossUnit;
    }
    buildItemTaxes(taxConfig) {
        return taxConfig.taxes.map((t) => ({
            code: t.code,
            rate: factusMoney(t.rate),
            ...(t.isExcluded ? { is_excluded: true } : {}),
        }));
    }
    toFactusBillItem(params, taxConfig) {
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
    mapItems(order, taxConfig) {
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
        return [...grouped.values()].map((g) => this.toFactusBillItem({
            code_reference: g.code,
            name: g.name,
            quantity: g.qty,
            grossUnit: g.unit,
            note: g.note,
        }, taxConfig));
    }
    mapExtras(order, taxConfig) {
        return (order.extras || []).map((ex, idx) => this.toFactusBillItem({
            code_reference: `EXTRA-${ex.id ?? idx}`,
            name: ex.title || 'Adicional',
            quantity: ex.quantity ?? 1,
            grossUnit: Number(ex.amount) || 0,
            note: ex.description || undefined,
        }, taxConfig));
    }
    deliveryAsExtra(order, taxConfig) {
        const fee = Number(order.deliveryFee) || 0;
        if (fee <= 0 || order.orderType !== 'delivery')
            return [];
        return [
            this.toFactusBillItem({
                code_reference: 'DELIVERY',
                name: 'Domicilio',
                quantity: 1,
                grossUnit: fee,
            }, taxConfig),
        ];
    }
    sumItemsGross(items) {
        return items.reduce((sum, i) => {
            const qty = parseFloat(i.quantity) || 0;
            const price = parseFloat(i.price) || 0;
            const line = qty * price;
            let tax = 0;
            for (const t of i.taxes || []) {
                const rate = parseFloat(t.rate || '0') || 0;
                if (!t.is_excluded && rate > 0)
                    tax += line * (rate / 100);
            }
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