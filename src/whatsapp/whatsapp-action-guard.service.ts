import { Injectable, Logger } from '@nestjs/common';
import type { AiOrderAction } from './types/whatsapp-session.types';
import type { WhatsappCatalogProduct } from './whatsapp-catalog.service';

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
      if (name.length >= 2) out.setCustomerName = name;
      else warnings.push('Nombre demasiado corto; pide nombre completo.');
    }

    if (params.actions.setAddress) {
      const addr = params.actions.setAddress.trim().slice(0, 500);
      if (addr.length >= 8) out.setAddress = addr;
      else warnings.push('Dirección demasiado corta; pide dirección completa.');
    }

    if (params.actions.setOrderType === 'delivery' || params.actions.setOrderType === 'pickup') {
      out.setOrderType = params.actions.setOrderType;
    }

    if (params.actions.setPaymentMethod === 'cash') {
      out.setPaymentMethod = 'cash';
    } else if (params.actions.setPaymentMethod === 'mercadopago') {
      if (params.allowMercadoPago) out.setPaymentMethod = 'mercadopago';
      else warnings.push('Mercado Pago no está habilitado; solo contra entrega.');
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
          warnings.push(
            `"${product.name}" requiere elegir: ${this.formatAttributeOptions(product)}.`,
          );
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
    if (normalized.length !== product.attributes.length) {
      warnings.push(
        `Opciones inválidas para "${product.name}". Elige: ${this.formatAttributeOptions(product)}.`,
      );
      return undefined;
    }
    return normalized;
  }

  formatAttributeOptions(product: WhatsappCatalogProduct): string {
    return (product.attributes || [])
      .map((a) => `${a.attributeName}: ${a.options.join(' / ')}`)
      .join('; ');
  }
}
