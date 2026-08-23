"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WhatsappActionGuardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappActionGuardService = void 0;
const common_1 = require("@nestjs/common");
let WhatsappActionGuardService = WhatsappActionGuardService_1 = class WhatsappActionGuardService {
    logger = new common_1.Logger(WhatsappActionGuardService_1.name);
    sanitize(params) {
        const warnings = [];
        if (!params.actions) {
            return { actions: undefined, warnings, blockedClosed: false };
        }
        if (!params.businessOpen) {
            this.logger.warn('Acciones IA descartadas: restaurante cerrado');
            return {
                actions: { requestHuman: params.actions.requestHuman },
                warnings: ['Pedido no procesado: restaurante cerrado.'],
                blockedClosed: true,
            };
        }
        const out = {};
        const byId = new Map(params.products.map((p) => [p.id, p]));
        if (params.actions.requestHuman)
            out.requestHuman = true;
        if (params.actions.clearCart)
            out.clearCart = true;
        if (params.actions.requestConfirm) {
            warnings.push('La confirmación solo la hace el cliente escribiendo "confirmar".');
        }
        if (params.actions.setCustomerName) {
            const name = params.actions.setCustomerName.trim().slice(0, 120);
            if (name.length >= 2)
                out.setCustomerName = name;
            else
                warnings.push('Nombre demasiado corto; pide nombre completo.');
        }
        if (params.actions.setAddress) {
            const addr = params.actions.setAddress.trim().slice(0, 500);
            if (addr.length >= 8)
                out.setAddress = addr;
            else
                warnings.push('Dirección demasiado corta; pide dirección completa.');
        }
        if (params.actions.setOrderType === 'delivery' || params.actions.setOrderType === 'pickup') {
            out.setOrderType = params.actions.setOrderType;
        }
        if (params.actions.setPaymentMethod === 'cash') {
            out.setPaymentMethod = 'cash';
        }
        else if (params.actions.setPaymentMethod === 'mercadopago') {
            if (params.allowMercadoPago)
                out.setPaymentMethod = 'mercadopago';
            else
                warnings.push('Mercado Pago no está habilitado; solo contra entrega.');
        }
        if (params.actions.removeProductIds?.length) {
            out.removeProductIds = params.actions.removeProductIds.filter((id) => byId.has(id));
        }
        if (params.actions.addItems?.length) {
            out.addItems = [];
            for (const item of params.actions.addItems) {
                const product = byId.get(item.productId);
                if (!product) {
                    warnings.push(`Producto id ${item.productId} no existe en el menú; ignorado.`);
                    continue;
                }
                if (product.availableNow === false) {
                    warnings.push(`"${product.name}" no está disponible en este horario.`);
                    continue;
                }
                const qty = Math.min(Math.max(1, item.quantity ?? 1), 10);
                const attrs = this.normalizeAttributes(product, item.attributes, warnings);
                if (product.hasAttributes && !attrs?.length) {
                    warnings.push(`"${product.name}" requiere elegir: ${this.formatAttributeOptions(product)}.`);
                    continue;
                }
                out.addItems.push({
                    productId: product.id,
                    quantity: qty,
                    note: item.note?.trim().slice(0, 200),
                    attributes: attrs,
                });
            }
            if (!out.addItems.length)
                delete out.addItems;
        }
        const hasKeys = Object.keys(out).length > 0;
        return { actions: hasKeys ? out : undefined, warnings, blockedClosed: false };
    }
    normalizeAttributes(product, incoming, warnings) {
        if (!product.hasAttributes || !product.attributes?.length)
            return undefined;
        if (!incoming?.length)
            return undefined;
        const normalized = [];
        for (const def of product.attributes) {
            const match = incoming.find((a) => a.attributeName?.trim().toLowerCase() === def.attributeName.toLowerCase() &&
                def.options.some((o) => o.toLowerCase() === a.attributeValue?.trim().toLowerCase()));
            if (match) {
                const opt = def.options.find((o) => o.toLowerCase() === match.attributeValue.trim().toLowerCase());
                normalized.push({ attributeName: def.attributeName, attributeValue: opt || match.attributeValue.trim() });
            }
        }
        if (normalized.length !== product.attributes.length) {
            warnings.push(`Opciones inválidas para "${product.name}". Elige: ${this.formatAttributeOptions(product)}.`);
            return undefined;
        }
        return normalized;
    }
    formatAttributeOptions(product) {
        return this.formatProductOptionsInline(product);
    }
    formatProductOptionsInline(product) {
        const parts = [];
        if (product.description) {
            parts.push(`📝 ${product.description}`);
        }
        for (const a of product.attributes || []) {
            const opts = a.options.map((o, i) => `${i + 1}) ${o}`).join('\n  ');
            parts.push(`*${a.attributeName}:*\n  ${opts}`);
        }
        return parts.join('\n\n') || (product.attributes || []).map((a) => `${a.attributeName}: ${a.options.join(' / ')}`).join('; ');
    }
};
exports.WhatsappActionGuardService = WhatsappActionGuardService;
exports.WhatsappActionGuardService = WhatsappActionGuardService = WhatsappActionGuardService_1 = __decorate([
    (0, common_1.Injectable)()
], WhatsappActionGuardService);
//# sourceMappingURL=whatsapp-action-guard.service.js.map