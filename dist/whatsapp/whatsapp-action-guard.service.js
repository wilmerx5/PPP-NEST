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
var WhatsappActionGuardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappActionGuardService = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_catalog_service_1 = require("./whatsapp-catalog.service");
const whatsapp_payment_methods_1 = require("./whatsapp-payment-methods");
const whatsapp_session_intents_1 = require("./whatsapp-session-intents");
const whatsapp_intent_1 = require("./whatsapp-intent");
let WhatsappActionGuardService = WhatsappActionGuardService_1 = class WhatsappActionGuardService {
    catalogService;
    logger = new common_1.Logger(WhatsappActionGuardService_1.name);
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
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
        const validLine = (line) => byId.has(line.productId) && Number.isInteger(line.cartLineIndex) && line.cartLineIndex >= 0;
        if (params.actions.removeCartLines?.length) {
            out.removeCartLines = params.actions.removeCartLines.filter(line => Number.isInteger(line.productId) && line.productId > 0 && Number.isInteger(line.cartLineIndex) && line.cartLineIndex >= 0);
            if (!out.removeCartLines.length)
                delete out.removeCartLines;
        }
        if (params.actions.updateCartLines?.length) {
            out.updateCartLines = params.actions.updateCartLines.filter(validLine).map(line => ({
                productId: line.productId, cartLineIndex: line.cartLineIndex,
                ...(typeof line.quantity === 'number' && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 10 ? { quantity: line.quantity } : {}),
                ...(typeof line.note === 'string' ? { note: line.note.trim().slice(0, 200) } : {}),
            })).filter(line => line.quantity !== undefined || line.note !== undefined);
            if (!out.updateCartLines.length)
                delete out.updateCartLines;
        }
        if (params.actions.requestConfirm) {
            warnings.push('La confirmación solo la hace el cliente escribiendo "confirmar".');
        }
        if (params.actions.setCustomerName) {
            const name = params.actions.setCustomerName.trim().slice(0, 120);
            if ((0, whatsapp_session_intents_1.isUsableWhatsappCustomerName)(name))
                out.setCustomerName = name;
            else if (name.length >= 2) {
                warnings.push('Nombre no usable (placeholder); pide nombre completo.');
            }
            else
                warnings.push('Nombre demasiado corto; pide nombre completo.');
        }
        if (params.actions.setAddress) {
            const addr = params.actions.setAddress.trim().slice(0, 500);
            if (addr.length >= 8 && (0, whatsapp_intent_1.looksLikeAddressOnlyMessage)(addr))
                out.setAddress = addr;
            else
                warnings.push('Eso no es una dirección; no se guardó domicilio.');
        }
        if (params.actions.updateAttributes?.length) {
            out.updateAttributes = [];
            for (const upd of params.actions.updateAttributes) {
                const product = byId.get(upd.productId);
                const attr = product?.attributes?.find((a) => a.attributeName.toLowerCase() === upd.attributeName.trim().toLowerCase());
                const matched = attr
                    ? this.catalogService.matchAttributeOptionValue(upd.attributeValue, attr.options)
                    : null;
                if (!product || !attr || !matched) {
                    warnings.push(`No se cambió ${upd.attributeName || 'la opción'}: no está en ese producto.`);
                    continue;
                }
                out.updateAttributes.push({
                    productId: product.id,
                    ...(typeof upd.cartLineIndex === 'number' && Number.isInteger(upd.cartLineIndex) && upd.cartLineIndex >= 0 ? { cartLineIndex: upd.cartLineIndex } : {}),
                    attributeName: attr.attributeName,
                    attributeValue: matched,
                });
            }
            if (!out.updateAttributes.length)
                delete out.updateAttributes;
        }
        if (params.actions.setOrderType === 'delivery' || params.actions.setOrderType === 'pickup') {
            out.setOrderType = params.actions.setOrderType;
        }
        if (params.actions.setPaymentMethod) {
            const methods = params.paymentMethods || [];
            const enabled = (0, whatsapp_payment_methods_1.getEnabledPaymentMethods)(methods);
            const raw = String(params.actions.setPaymentMethod).trim();
            const byIdMatch = enabled.find((m) => m.id === raw);
            const byText = (0, whatsapp_payment_methods_1.findPaymentMethodByText)(raw, methods);
            const matched = byIdMatch || byText;
            if (matched) {
                if (matched.flow === 'mercadopago' && !params.allowMercadoPago) {
                    warnings.push('Mercado Pago no está habilitado.');
                }
                else {
                    out.setPaymentMethod = matched.id;
                }
            }
            else if (raw === 'cash' || raw === 'mercadopago') {
                if (raw === 'cash')
                    out.setPaymentMethod = 'cash';
                else if (params.allowMercadoPago)
                    out.setPaymentMethod = 'mercadopago';
                else
                    warnings.push('Mercado Pago no está habilitado.');
            }
            else {
                warnings.push('Método de pago no disponible.');
            }
        }
        if (params.actions.setCashChangeFor) {
            const v = params.actions.setCashChangeFor.trim().slice(0, 120);
            if (v.length >= 1)
                out.setCashChangeFor = v;
        }
        if (params.actions.setCustomerNotes) {
            const v = params.actions.setCustomerNotes.trim().slice(0, 400);
            if (v.length >= 1)
                out.setCustomerNotes = v;
        }
        if (params.actions.removeProductIds?.length) {
            out.removeProductIds = params.actions.removeProductIds.filter(id => Number.isInteger(id) && id > 0);
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
                let attrs = this.normalizeAttributes(product, item.attributes, warnings);
                if (product.hasAttributes && product.attributes?.length && !attrs?.length) {
                    attrs = this.catalogService.fillDefaultAttributes(product, []);
                }
                if (product.hasAttributes && product.attributes?.length && !attrs?.length) {
                    warnings.push(`"${product.name}" requiere elegir opciones antes de agregarlo.`);
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
        if (!this.catalogService.isAttributeSelectionComplete(product, normalized)) {
            const completed = this.catalogService.fillDefaultAttributes(product, normalized);
            if (normalized.length && this.catalogService.isAttributeSelectionComplete(product, completed)) {
                return completed;
            }
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
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [whatsapp_catalog_service_1.WhatsappCatalogService])
], WhatsappActionGuardService);
//# sourceMappingURL=whatsapp-action-guard.service.js.map