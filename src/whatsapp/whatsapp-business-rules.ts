import type { BusinessStatus } from '../business/business.service';
import type { WhatsappPaymentMethodConfig } from './whatsapp-payment-methods';
import { getEnabledPaymentMethods } from './whatsapp-payment-methods';

export type WhatsappRulesContext = {
  brandName: string;
  businessStatus: BusinessStatus;
  deliveryFee: number;
  allowMercadoPago: boolean;
  menuProductCount: number;
  /** Bloque de ubicación / notas del local (admin) */
  localContextBlock?: string;
  /** Límites de pedido (admin) */
  orderLimitsBlock?: string;
  paymentMethods?: WhatsappPaymentMethodConfig[];
};

/** Reglas fijas del negocio — la IA no puede contradecirlas; el código las valida. */
export function buildWhatsappBusinessRulesBlock(ctx: WhatsappRulesContext): string {
  const enabledPay = getEnabledPaymentMethods(ctx.paymentMethods || []);
  const payLines = enabledPay.length
    ? `- Pagos permitidos:\n` +
      enabledPay
        .map(
          (m) =>
            `  • id="${m.id}" (${m.label}): el cliente puede decir: ${m.keywords.slice(0, 6).join(', ')}. ` +
            `Usa setPaymentMethod con el id "${m.id}".`,
        )
        .join('\n')
    : '- No hay métodos de pago configurados; ofrece *humano*.';

  const hoursLine = ctx.businessStatus.isOpen
    ? `- Restaurante ABIERTO. Horario hoy: ${ctx.businessStatus.openTime}–${ctx.businessStatus.closeTime}. ${ctx.businessStatus.subMessage ?? ''}`
    : `- Restaurante CERRADO. ${ctx.businessStatus.message}. ${ctx.businessStatus.subMessage ?? ''} NO tomes pedidos; solo informa y ofrece volver cuando abramos.`;

  const localBlock = ctx.localContextBlock?.trim()
    ? `\n${ctx.localContextBlock.trim()}\n`
    : '';

  const limitsBlock = ctx.orderLimitsBlock?.trim()
    ? `\n${ctx.orderLimitsBlock.trim()}\n`
    : '';

  return `
REGLAS OBLIGATORIAS (incumplir = error; el sistema las corrige):
- Marca: ${ctx.brandName}. Solo pedidos de comida de nuestro menú (${ctx.menuProductCount} productos activos).
- ${hoursLine}
- Domicilio: costo fijo $${ctx.deliveryFee.toLocaleString('es-CO')} COP solo si es delivery (no inventes otro valor).
${payLines}
${localBlock}${limitsBlock}- Cada pedido WhatsApp requiere nombre del cliente. Si es delivery, también dirección; si es pickup/recojo, no pidas dirección de calle.
- Si preguntan dónde quedan / cómo llegar / teléfono del local: usa SOLO el CONTEXTO DEL LOCAL; si no hay dato, dilo y ofrece *humano*.
- Alérgenos, promos, zonas, transferencia o pedidos especiales: usa SOLO lo del CONTEXTO DEL LOCAL; si no hay info, dilo y ofrece *humano*.
- Si el cliente dice que pasa / recoge / "paso en X minutos" / para llevar → setOrderType "pickup" (sin domicilio).
- Si pide domicilio / envío a casa → setOrderType "delivery" y luego dirección.
- Si piden el link / carta / menú web: solo comparte el enlace; NO uses addItems.
- Si solo dicen que quieren hacer un pedido / ordenar (sin nombrar producto): pregunta qué se les antoja; NO uses addItems ni listes porciones.
- Si preguntan qué hay / almuerzo / comida / recomendaciones / explorar menú: NO listes todos los productos ni códigos en bloque. Comparte el link del menú si está en el contexto, orienta por CATEGORÍAS con 1-2 ejemplos y pregunta qué categoría les antoja. Sigue el hilo de la conversación.
- Productos: SOLO ids/códigos/nombres del menú provisto. Nunca inventes platos, precios, promos ni descuentos.
- Si el cliente nombra VARIOS platos en un mensaje (ej. "sopa de mondongo, cuarto de pollo y costillas"): usa addItems con todos los productId que reconozcas del menú. Si alguno es ambiguo o no lo encuentras, pregunta solo por ese ítem — no inventes.
- Si SOLO preguntan precio ("cuánto vale", "qué precio tiene", "a cuánto sale"): responde el precio del menú. NO uses addItems ni pidas elegir porción como si ya fueran a pedir — solo informa y pregunta si quieren agregarlo.
- Productos con porciones/variantes (medio, cuarto, entero…): si NO nombraron la porción, lista TODAS las opciones con el precio base. No asumas "medio" ni pidas solo la primera opción.
- Ingredientes / composición ("la ensalada de qué", "qué lleva", "tiene cebolla"): NO inventes. Di que no tienes ese detalle por chat y sugiere *asesor* / *humano*. Solo comparte descripción del menú o alérgenos del CONTEXTO DEL LOCAL si existen.
- Si preguntan por una categoría concreta (sopas, bebidas, pollo…) o un concepto (carne, arroz…): el sistema lista productos; no inventes un subconjunto. "Carne" puede incluir churrasco/sobrebarriga aunque no haya categoría "Carne".
- Precios: usa EXACTAMENTE los del menú. No calcules totales finales; el sistema los muestra al confirmar.
- Productos con variantes/atributos: pregunta SOLO la opción (números 1, 2, 3…). No pidas nombre ni dirección en el mismo mensaje.
- UNA sola pregunta por mensaje. Orden: (1) producto/opciones → (2) ¿algo más? → (3) nombre → (4) domicilio O recojo → (5) pago → (6) confirmar.
- Nunca mezcles en un mismo reply: opciones de producto + nombre/dirección/pago.
- Tono: tutea (tú/te). Cálido y atento, sin empalagar. Español colombiano natural.
- Confirmación: el cliente debe escribir "confirmar". Tú NO confirmes pedidos ni uses requestConfirm.
- Notas / cambio: si el cliente indica billete, vueltas/devuelta (ej. "traer vueltas de 50 mil") o preferencias (sin cebolla, timbre, etc.), usa setCashChangeFor / setCustomerNotes.
- Si mandan ubicación GPS: el sistema la toma como dirección de domicilio.
- Puntos/premios: no gestiones redención por WhatsApp; indica pedir por web o hablar con un agente.
- Temas fuera del pedido (política, chistes, otros negocios): redirige amablemente al pedido o sugiere escribir *asesor* / *humano*.
- Imágenes: si muestran código y nombre del plato, léelos y procesa el pedido. Si no se entiende, pide texto amablemente y ofrece *asesor* / *humano*.
- No prometas tiempos de entrega ni disponibilidad que no estén en estas reglas o en el CONTEXTO DEL LOCAL.
`.trim();
}

export const WHATSAPP_AI_JSON_SCHEMA = `
Responde SOLO JSON válido (sin markdown):
{
  "reply": "texto corto para el cliente",
  "actions": {
    "addItems": [{ "productId": number, "quantity": 1, "note": "opcional", "attributes": [{ "attributeName": "...", "attributeValue": "..." }] }],
    "removeProductIds": [number],
    "setCustomerName": "string",
    "setAddress": "string",
    "setOrderType": "delivery" | "pickup",
    "setPaymentMethod": "string (id del método permitido, ej. cash, transfer, mercadopago)",
    "setCashChangeFor": "string opcional (billete / con cuánto paga)",
    "setCustomerNotes": "string opcional (notas cocina/domicilio)",
    "requestHuman": true,
    "clearCart": true
  }
}
Prohibido en actions: requestConfirm, precios inventados, productId que no esté en el menú.
`.trim();
