import { Injectable, Logger } from '@nestjs/common';
import type { AiOrderAction } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
import { findPaymentMethodByText, getEnabledPaymentMethods } from './whatsapp-payment-methods';
import { isUsableWhatsappCustomerName } from './whatsapp-session-intents';

export type GuardResult = {
  actions: AiOrderAction | undefined;
  warnings: string[];
  blockedClosed: boolean;
};

@Injectable()
export class WhatsappActionGuardService {
  private readonly logger = new Logger(WhatsappActionGuardService.name);

  sanitize(params: {
    actions: AiOrderAction | undefined;
    products: WhatsappCatalogProduct[];
    businessOpen: boolean;
    allowMercadoPago: boolean;
    paymentMethods?: WhatsappPaymentMethodConfig[];
  }): GuardResult {
    const warnings: string[] = [];
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

    const out: AiOrderAction = {};
    const byId = new Map(params.products.map((p) => [p.id, p]));

    if (params.actions.requestHuman) out.requestHuman = true;
    if (params.actions.clearCart) out.clearCart = true;

    if (params.actions.requestConfirm) {
      warnings.push('La confirmación solo la hace el cliente escribiendo "confirmar".');
    }

    if (params.actions.setCustomerName) {
      const name = params.actions.setCustomerName.trim().slice(0, 120);
      if (isUsableWhatsappCustomerName(name)) out.setCustomerName = name;
      else if (name.length >= 2) {
        warnings.push('Nombre no usable (placeholder); pide nombre completo.');
      } else warnings.push('Nombre demasiado corto; pide nombre completo.');
    }

    if (params.actions.setAddress) {
      const addr = params.actions.setAddress.trim().slice(0, 500);
      if (addr.length >= 8) out.setAddress = addr;
      else warnings.push('Dirección demasiado corta; pide dirección completa.');
    }

    if (params.actions.setOrderType === 'delivery' || params.actions.setOrderType === 'pickup') {
      out.setOrderType = params.actions.setOrderType;
    }

    if (params.actions.setPaymentMethod) {
      const methods = params.paymentMethods || [];
      const enabled = getEnabledPaymentMethods(methods);
      const raw = String(params.actions.setPaymentMethod).trim();
      const byIdMatch = enabled.find((m) => m.id === raw);
      const byText = findPaymentMethodByText(raw, methods);
      const matched = byIdMatch || byText;
      if (matched) {
        if (matched.flow === 'mercadopago' && !params.allowMercadoPago) {
          warnings.push('Mercado Pago no está habilitado.');
        } else {
          out.setPaymentMethod = matched.id;
        }
      } else if (raw === 'cash' || raw === 'mercadopago') {
        // Compat legacy
        if (raw === 'cash') out.setPaymentMethod = 'cash';
        else if (params.allowMercadoPago) out.setPaymentMethod = 'mercadopago';
        else warnings.push('Mercado Pago no está habilitado.');
      } else {
        warnings.push('Método de pago no disponible.');
      }
    }

    if (params.actions.setCashChangeFor) {
      const v = params.actions.setCashChangeFor.trim().slice(0, 120);
      if (v.length >= 1) out.setCashChangeFor = v;
    }
    if (params.actions.setCustomerNotes) {
      const v = params.actions.setCustomerNotes.trim().slice(0, 400);
      if (v.length >= 1) out.setCustomerNotes = v;
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
      if (!out.addItems.length) delete out.addItems;
    }

    const hasKeys = Object.keys(out).length > 0;
    return { actions: hasKeys ? out : undefined, warnings, blockedClosed: false };
  }

  private normalizeAttributes(
    product: WhatsappCatalogProduct,
    incoming: { attributeName: string; attributeValue: string }[] | undefined,
    warnings: string[],
  ) {
    if (!product.hasAttributes || !product.attributes?.length) return undefined;
    if (!incoming?.length) return undefined;

    const normalized: { attributeName: string; attributeValue: string }[] = [];
    for (const def of product.attributes) {
      const match = incoming.find(
        (a) =>
          a.attributeName?.trim().toLowerCase() === def.attributeName.toLowerCase() &&
          def.options.some((o) => o.toLowerCase() === a.attributeValue?.trim().toLowerCase()),
      );
      if (match) {
        const opt = def.options.find(
          (o) => o.toLowerCase() === match.attributeValue.trim().toLowerCase(),
        );
        normalized.push({ attributeName: def.attributeName, attributeValue: opt || match.attributeValue.trim() });
      }
    }

    const hasCombo = normalized.some((s) => /\bcombo\b/i.test(s.attributeValue));
    const requiredAttrs = product.attributes.filter((def) => {
      const n = def.attributeName.toLowerCase();
      const comboOnly = /\b(gaseosa|gaseosas|bebida|bebidas|refresco|refrescos)\b/.test(n);
      if (comboOnly && !hasCombo) return false;
      return true;
    });

    if (normalized.length !== requiredAttrs.length) {
      warnings.push(
        `Opciones inválidas para "${product.name}". Elige: ${this.formatAttributeOptions(product)}.`,
      );
      return undefined;
    }
    return normalized;
  }

  formatAttributeOptions(product: WhatsappCatalogProduct): string {
    // Delega al formato enriquecido del catálogo (descripción + opciones numeradas)
    return this.formatProductOptionsInline(product);
  }

  private formatProductOptionsInline(product: WhatsappCatalogProduct): string {
    const parts: string[] = [];
    if (product.description) {
      parts.push(`📝 ${product.description}`);
    }
    for (const a of product.attributes || []) {
      const opts = a.options.map((o, i) => `${i + 1}) ${o}`).join('\n  ');
      parts.push(`*${a.attributeName}:*\n  ${opts}`);
    }
    return parts.join('\n\n') || (product.attributes || []).map((a) => `${a.attributeName}: ${a.options.join(' / ')}`).join('; ');
  }
}
