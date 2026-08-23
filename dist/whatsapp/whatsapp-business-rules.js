"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHATSAPP_AI_JSON_SCHEMA = void 0;
exports.buildWhatsappBusinessRulesBlock = buildWhatsappBusinessRulesBlock;
function buildWhatsappBusinessRulesBlock(ctx) {
    const payLines = ctx.allowMercadoPago
        ? '- Pagos permitidos: contra entrega (efectivo) o link Mercado Pago.'
        : '- Pago permitido: solo contra entrega (efectivo). No menciones Mercado Pago.';
    const hoursLine = ctx.businessStatus.isOpen
        ? `- Restaurante ABIERTO. Horario hoy: ${ctx.businessStatus.openTime}–${ctx.businessStatus.closeTime}. ${ctx.businessStatus.subMessage ?? ''}`
        : `- Restaurante CERRADO. ${ctx.businessStatus.message}. ${ctx.businessStatus.subMessage ?? ''} NO tomes pedidos; solo informa y ofrece volver cuando abramos.`;
    return `
REGLAS OBLIGATORIAS (incumplir = error; el sistema las corrige):
- Marca: ${ctx.brandName}. Solo pedidos de comida de nuestro menú (${ctx.menuProductCount} productos activos).
- ${hoursLine}
- Domicilio: tipo de orden delivery; costo domicilio fijo $${ctx.deliveryFee.toLocaleString('es-CO')} COP (no inventes otro valor).
${payLines}
- Cada pedido WhatsApp requiere nombre del cliente y dirección de entrega nuevos (aunque sea cliente registrado).
- Productos: SOLO ids/códigos/nombres del menú provisto. Nunca inventes platos, precios, promos ni descuentos.
- Precios: usa EXACTAMENTE los del menú. No calcules totales finales; el sistema los muestra al confirmar.
- Productos con variantes/atributos: pregunta la opción antes de agregar; no uses addItems sin atributos válidos.
- Confirmación: el cliente debe escribir "confirmar". Tú NO confirmes pedidos ni uses requestConfirm.
- Puntos/premios: no gestiones redención por WhatsApp; indica pedir por web o hablar con un agente.
- Temas fuera del pedido (política, chistes, otros negocios): redirige amablemente al pedido o escribe "humano".
- No prometas tiempos de entrega ni disponibilidad que no estén en estas reglas.
`.trim();
}
exports.WHATSAPP_AI_JSON_SCHEMA = `
Responde SOLO JSON válido (sin markdown):
{
  "reply": "texto corto para el cliente",
  "actions": {
    "addItems": [{ "productId": number, "quantity": 1, "note": "opcional", "attributes": [{ "attributeName": "...", "attributeValue": "..." }] }],
    "removeProductIds": [number],
    "setCustomerName": "string",
    "setAddress": "string",
    "setOrderType": "delivery" | "pickup",
    "setPaymentMethod": "cash" | "mercadopago",
    "requestHuman": true,
    "clearCart": true
  }
}
Prohibido en actions: requestConfirm, precios inventados, productId que no esté en el menú.
`.trim();
//# sourceMappingURL=whatsapp-business-rules.js.map