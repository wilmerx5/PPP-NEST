/**
 * Clasificador de intención del mensaje WhatsApp.
 * Separar "entender" de "ejecutar": el matching de catálogo / addItems
 * solo aplica cuando la intención es pedido de producto.
 */

export type WhatsappMessageIntent =
  | 'order_product'
  | 'side_note'
  | 'menu_question'
  | 'price_question'
  | 'payment'
  | 'checkout_data'
  | 'human'
  | 'chitchat'
  | 'other';

export type WhatsappIntentHints = {
  text: string;
  /** Ítems ya en carrito (notas de guarnición solo con carrito). */
  cartLength: number;
  looksLikeSideModificationNote?: boolean;
  isPriceInquiry?: boolean;
  isMenuExplore?: boolean;
  isCategoryBrowse?: boolean;
  isGenericProductInquiry?: boolean;
  isOffTopicChitchat?: boolean;
  isHumanRequest?: boolean;
  isPaymentMention?: boolean;
  isCheckoutFieldReply?: boolean;
};

const HUMAN_RE =
  /\b(humano|asesor|persona|operador|alguien\s+del\s+(?:local|restaurante)|hablar\s+con\s+(?:alguien|una\s+persona))\b/i;

const PAYMENT_RE =
  /\b(contraentrega|efectivo|cash|transferencia|nequi|daviplata|mercadopago|mercado\s*pago|pago\s+con)\b/i;

const CHECKOUT_DATA_RE =
  /\b(me\s+llamo|mi\s+nombre\s+es|soy\s+[a-záéíóúñ]|vivo\s+en|dirección|direccion|carrera|calle|diagonal|transversal|conjunto|urbanizaci[oó]n|apto|apartamento|torre)\b/i;

/**
 * Prioridad: humano > pago > nota de guarnición > precio > menú/duda >
 * checkout > charla > pedido > other.
 */
export function classifyWhatsappCustomerIntent(
  hints: WhatsappIntentHints,
): WhatsappMessageIntent {
  const text = (hints.text || '').trim();
  if (!text) return 'other';

  if (hints.isHumanRequest || HUMAN_RE.test(text)) return 'human';

  if (hints.isPaymentMention || PAYMENT_RE.test(text)) return 'payment';

  if (
    hints.cartLength > 0 &&
    (hints.looksLikeSideModificationNote ||
      /\b(no\s+quiero|sin|mas|más)\s+(?:de\s+)?(?:arepas?|papas?|yuca|ensalada|cebolla)\b/i.test(
        text,
      ))
  ) {
    // "dame 2 arepas" es pedido; "no quiero arepas" con carrito es nota
    if (
      !/\b(dame|ponme|agrega|agregar|pedi|pido|ordenar)\b/i.test(text) ||
      /\bno\s+quiero\b/i.test(text)
    ) {
      if (
        hints.looksLikeSideModificationNote ||
        /\b(para\s+(?:el\s+)?combo|sin\s+|no\s+quiero|quiero\s+(?:mas|más))\b/i.test(text)
      ) {
        return 'side_note';
      }
    }
  }

  if (hints.isPriceInquiry) return 'price_question';

  if (
    hints.isMenuExplore ||
    hints.isCategoryBrowse ||
    hints.isGenericProductInquiry
  ) {
    return 'menu_question';
  }

  if (hints.isCheckoutFieldReply || CHECKOUT_DATA_RE.test(text)) {
    // Si también nombra comida clara, priorizar pedido
    if (
      !/\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster)\b/i.test(
        text,
      )
    ) {
      return 'checkout_data';
    }
  }

  if (hints.isOffTopicChitchat) return 'chitchat';

  if (
    /\b(quiero|dame|ponme|pedi|pido|agrega|mandame|traeme|unos?|unas?|\d+)\b/i.test(text) ||
    /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo)\b/i.test(
      text,
    )
  ) {
    return 'order_product';
  }

  return 'other';
}

/** ¿Esta intención puede disparar addItems de la IA? */
export function intentAllowsAddItems(intent: WhatsappMessageIntent): boolean {
  return intent === 'order_product' || intent === 'other';
}

/** Texto corto para inyectar en el prompt de la IA. */
export function formatIntentHintForAi(intent: WhatsappMessageIntent): string {
  switch (intent) {
    case 'side_note':
      return (
        'INTENCIÓN DETECTADA: nota de guarnición/preferencia sobre un ítem YA en el carrito. ' +
        'PROHIBIDO addItems. Usa setCustomerNotes o describe la nota; el sistema la pega al último ítem.'
      );
    case 'price_question':
      return 'INTENCIÓN: consulta de precio. Informa precios del menú. NO uses addItems.';
    case 'menu_question':
      return 'INTENCIÓN: explorar/dudar del menú. Orienta por categorías. NO uses addItems.';
    case 'payment':
      return 'INTENCIÓN: método de pago. Usa setPaymentMethod con un id permitido. NO uses addItems.';
    case 'checkout_data':
      return 'INTENCIÓN: dato de checkout (nombre/dirección). Usa setCustomerName o setAddress. NO uses addItems.';
    case 'human':
      return 'INTENCIÓN: pedir asesor humano. Usa requestHuman.';
    case 'chitchat':
      return 'INTENCIÓN: charla fuera de pedido. Redirige amable al menú o *asesor*. NO uses addItems.';
    case 'order_product':
      return (
        'INTENCIÓN: pedido de producto. Solo addItems con productId del menú autorizado. ' +
        'Si el carrito ya tiene un combo/plato y el mensaje es solo preferencia de acompañamiento, NO agregues arepas/papas como ítems.'
      );
    default:
      return 'INTENCIÓN: no clara. Si no hay producto claro, pregunta; no inventes addItems.';
  }
}
