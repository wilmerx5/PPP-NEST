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
  | 'address'
  | 'clear_cart'
  | 'human'
  | 'chitchat'
  | 'other';

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vaciar / limpiar carrito o pedido en armado (imperativo y typos comunes). */
export function looksLikeClearCartMessage(text: string): boolean {
  const t = normalizeIntentText(text);
  if (!t) return false;

  if (
    /^(reiniciar|reinicia|reinciar|empezar\s+de\s+nuevo|empezar\s+otra\s+vez|nuevo\s+pedido|otro\s+pedido|borrar\s+carrito|limpiar\s+carrito|vaciar\s+carrito|vaciar\s+pedido|borrar\s+pedido|borrar\s+todo|quitar\s+todo|limpiar\s+todo|vaciar\s+todo|limpiar|limpia|vaciar|vacia)$/.test(
      t,
    )
  ) {
    return true;
  }

  const clearVerb =
    '(?:limpiar|limpia|vaciar|vacia|vacio|borrar|borra|quitar|quita|eliminar|elimina|sacar|saca|resetear|resetea|reiniciar|reinicia|reinciar)';
  const clearTarget =
    '(?:el\\s+|la\\s+|mi\\s+)?(?:carrito|pedido|todo|orden|lo\\s+que\\s+llevo|lo\\s+que\\s+pedi|de\\s+nuevo)';

  if (new RegExp(`\\b${clearVerb}\\s+${clearTarget}\\b`).test(t)) {
    return true;
  }
  if (new RegExp(`\\b${clearVerb}\\b`).test(t) && /\b(todo|carrito|pedido|orden)\b/.test(t)) {
    return true;
  }

  if (/\b(carrito|pedido)\s+(vacio|vacia|limpio|en blanco)\b/.test(t)) {
    return true;
  }
  if (/^(ya\s+)?no\s+quiero\s+nada\b/.test(t)) {
    return true;
  }
  if (/\bdejar\s+(el\s+)?(carrito|pedido)\s+(vacio|en blanco)\b/.test(t)) {
    return true;
  }

  return false;
}

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
  /** Solo domicilio / landmark (hospital, conjunto…). */
  looksLikeAddressOnly?: boolean;
  compoundAddress?: string | null;
  compoundProductText?: string | null;
};

const HUMAN_RE =
  /\b(humano|asesor|persona|operador|alguien\s+del\s+(?:local|restaurante)|hablar\s+con\s+(?:alguien|una\s+persona))\b/i;

const PAYMENT_RE =
  /\b(contraentrega|efectivo|cash|transferencia|nequi|daviplata|mercadopago|mercado\s*pago|pago\s+con)\b/i;

const CHECKOUT_DATA_RE =
  /\b(me\s+llamo|mi\s+nombre\s+es|soy\s+[a-záéíóúñ]|vivo\s+en|dirección|direccion|carrera|calle|diagonal|transversal|conjunto|urbanizaci[oó]n|apto|apartamento|torre)\b/i;

const ADDRESS_ONLY_RE =
  /^(?:para|direcci[oó]n|domicilio)\b.+/i;

const LANDMARK_KEYWORD_RE =
  /\b(hospital|cl[ií]nica|ips|conjunto|conj\.?|urbanizaci[oó]n|urb\.?|residencial|edificio|torres?|supermercado|exito|éxito|jumbo|ol[ií]mpica|centro\s+comercial|\bcc\b|colegio|universidad|iglesia|parque|plaza|estaci[oó]n|portal|kennedy|bosa|fontib[oó]n|engativ[aá]|suba|usaqu[eé]n|chapinero|soacha|mosquera)\b/i;

const STREET_ADDRESS_RE =
  /\b(calle|carrera|cra|cll|av\.?|avenida|diag(?:onal)?|transversal|barrio|habitaci[oó]n|apto|apartamento|torre)\b/i;

/** Comandos de carrito/pedido/checkout: nunca tratarlos como dirección. */
export function looksLikeNonAddressCommand(text: string): boolean {
  if (looksLikeClearCartMessage(text)) return true;

  const t = normalizeIntentText(text);
  if (!t) return false;

  if (/^(listo|ok|dale|confirmar|confirmo|si|no|ninguno|ninguna|nada|gracias)$/.test(t)) {
    return true;
  }
  if (/\b(cancelar|cancela|anular|anula)\b/.test(t)) return true;
  if (/\b(humano|asesor|persona|agente)\b/.test(t)) return true;
  if (PAYMENT_RE.test(text)) return true;
  if (
    /\b(quiero|dame|ponme|pedi|pido|agrega|agregar|ordenar|mandame|traeme)\b/.test(t) &&
    /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo)\b/.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

export type AddressOnlyHints = {
  compoundAddress?: string | null;
  compoundProductText?: string | null;
};

/**
 * ¿El mensaje es SOLO domicilio? Reglas estrictas: prefijo para/dirección,
 * landmark conocido o calle con número. NO acepta frases genéricas de 2–7 palabras.
 */
export function looksLikeAddressOnlyMessage(
  text: string,
  hints: AddressOnlyHints = {},
): boolean {
  const raw = (text || '').trim();
  if (raw.length < 4) return false;
  if (looksLikeNonAddressCommand(raw)) return false;

  if (
    /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo)\b/i.test(
      raw,
    )
  ) {
    return false;
  }

  const compoundAddr = hints.compoundAddress?.trim();
  const compoundProduct = hints.compoundProductText?.trim() || '';
  if (compoundAddr && compoundProduct.length < 3) return true;

  if (ADDRESS_ONLY_RE.test(raw)) {
    if (LANDMARK_KEYWORD_RE.test(raw) || STREET_ADDRESS_RE.test(raw)) return true;
  }

  if (STREET_ADDRESS_RE.test(raw) && /\d/.test(raw)) return true;
  if (LANDMARK_KEYWORD_RE.test(raw) && raw.length >= 6) return true;

  return false;
}

/**
 * Prioridad: humano > vaciar carrito > pago > nota > dirección > precio > menú >
 * checkout > charla > pedido > other.
 */
export function classifyWhatsappCustomerIntent(
  hints: WhatsappIntentHints,
): WhatsappMessageIntent {
  const text = (hints.text || '').trim();
  if (!text) return 'other';

  if (hints.isHumanRequest || HUMAN_RE.test(text)) return 'human';

  if (looksLikeClearCartMessage(text)) return 'clear_cart';

  if (hints.isPaymentMention || PAYMENT_RE.test(text)) return 'payment';

  if (
    hints.cartLength > 0 &&
    (hints.looksLikeSideModificationNote ||
      /\b(no\s+quiero|sin|mas|más)\s+(?:de\s+)?(?:arepas?|papas?|yuca|ensalada|cebolla)\b/i.test(
        text,
      ))
  ) {
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

  if (
    hints.cartLength > 0 &&
    (looksLikeAddressOnlyMessage(text, {
      compoundAddress: hints.compoundAddress,
      compoundProductText: hints.compoundProductText,
    }) ||
      hints.looksLikeAddressOnly)
  ) {
    return 'address';
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
    case 'address':
      return (
        'INTENCIÓN DETECTADA: dirección de domicilio. ' +
        'Usa setAddress con el texto del cliente. PROHIBIDO addItems y PROHIBIDO decir que no encontraste un plato.'
      );
    case 'clear_cart':
      return (
        'INTENCIÓN DETECTADA: vaciar o borrar el carrito/pedido en armado. ' +
        'Usa clearCart: true. PROHIBIDO setAddress, addItems y PROHIBIDO anotar el mensaje como dirección.'
      );
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
