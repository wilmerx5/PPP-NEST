export type WhatsappCartItem = {
  productId: number;
  name: string;
  code: number;
  quantity: number;
  unitPrice: number;
  note?: string;
  attributes?: { attributeName: string; attributeValue: string }[];
};

export type WhatsappProductAttribute = {
  attributeName: string;
  options: string[];
};

export type WhatsappProductCandidate = {
  id: number;
  name: string;
  code: number;
  price: number;
  description?: string | null;
  categoryName?: string;
  hasAttributes?: boolean;
  attributes?: WhatsappProductAttribute[];
  availableNow?: boolean;
};

export type WhatsappPendingAttribute = {
  productId: number;
  name: string;
  code: number;
  price: number;
  attributes: WhatsappProductAttribute[];
  /** Atributos ya elegidos en orden */
  selected: { attributeName: string; attributeValue: string }[];
  /** Intención solo/combo detectada al iniciar la elección */
  variantIntent?: 'combo' | 'solo';
  /** Texto/segmento original del pedido (para cantidad: "3 pollos") */
  sourceText?: string;
};

export type WhatsappSessionData = {
  cart: WhatsappCartItem[];
  orderType: 'delivery' | 'pickup';
  address?: string;
  paymentMethod?: string;
  /** Con cuánto paga / billete (contraentrega) */
  cashChangeFor?: string;
  /** Notas para cocina / domicilio */
  customerNotes?: string;
  /** Ya preguntamos notas/cambio (o dijo ninguno) */
  notesCollected?: boolean;
  /** Preference MP (para recuperar tras pago) */
  mpPreferenceId?: string;
  /**
   * Tras completar/cerrar un pedido: el historial habla del carrito anterior;
   * la IA no debe re-agregar esos productos salvo que el cliente los pida de nuevo.
   */
  ignorePriorOrderHistory?: boolean;
  pendingMatch?: {
    query: string;
    candidates: WhatsappProductCandidate[];
    /** info = eligió variante para ver detalle (no agregar al carrito) */
    intent?: 'info' | 'order';
    /** Cantidad pedida al elegir de la lista (ej. 5 pollos) */
    quantity?: number;
  };
  /** Varios platos en un mensaje: confirmar o resolver dudas antes de agregar. */
  pendingMultiOrder?: {
    confident: Array<{
      segment: string;
      productId: number;
      name: string;
      code: number;
      price: number;
    }>;
    ambiguous: Array<{
      segment: string;
      candidates: WhatsappProductCandidate[];
    }>;
    needsAttributes: Array<{
      segment: string;
      productId: number;
      name: string;
      code: number;
      price: number;
    }>;
    unresolved: string[];
  };
  /** Tras mostrar resumen de categorías: el cliente elige número o nombre. */
  pendingCategoryBrowse?: {
    categories: string[];
  };
  /**
   * Cantidad pedida cuando aún no se resolvió el plato
   * (ej. "quiero 3 mojarras" → luego "mojarras" / variante).
   */
  pendingQuantityHint?: {
    quantity: number;
    query: string;
  };
  pendingAttribute?: WhatsappPendingAttribute;
  /** Último plato del que se habló (para "damelo en combo", etc.). */
  productFocus?: {
    productId: number;
    name: string;
    variantBaseKey?: string;
  };
  /** El cliente pidió quitar algo ambiguo: elige línea del carrito por número. */
  pendingCartRemoval?: {
    options: Array<{ cartIndex: number; label: string }>;
  };
  /**
   * Tras cotizar precio (“¿Te lo agrego?”): si responde *sí*, agregar este SKU.
   */
  pendingAddOffer?: {
    productId: number;
    name: string;
    code: number;
    price: number;
    quantity: number;
  };
  /**
   * Preguntamos “¿de qué plato?” (acompañamiento/ingredientes) y esperamos el nombre.
   * El siguiente plato nombrado → detalle, NO agregar al carrito.
   */
  pendingCompositionAsk?: {
    originalText: string;
  };
  /** Ya eligió domicilio vs recojo en este pedido */
  fulfillmentChosen?: boolean;
  /** Dirección ya confirmada (no solo inferida del mensaje) */
  addressConfirmed?: boolean;
  /**
   * Última dirección de domicilio exitosa (sobrevive reset/reopen).
   * Para ofrecer “¿Misma dirección? / acá” en el siguiente pedido.
   */
  lastDeliveryAddress?: string | null;
  /** Lat/lng del domicilio (geocode o pin de WhatsApp) */
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  /** Km de ruta restaurante → domicilio */
  deliveryDistanceKm?: number | null;
  /** Fee calculado para este pedido (COP) */
  deliveryFeeCalculated?: number | null;
  /** Dirección fuera de cobertura por km */
  deliveryOutOfCoverage?: boolean;
  /** Teléfono de contacto ya confirmado para este pedido */
  phoneConfirmed?: boolean;
  /** Teléfono de contacto (si difiere del WhatsApp) */
  contactPhone?: string | null;
  awaitingField?: 'name' | 'address' | 'payment' | 'notes' | 'confirm' | 'phone' | 'fulfillment';
  linkedUserId?: string | null;
  linkedUserName?: string | null;
  /** Premio de puntos validado para aplicar al confirmar pedido */
  pendingRedemptionCode?: string | null;
  pendingRedemptionExpiresAt?: string | null;
};

export type WhatsappConversationState =
  | 'building_cart'
  | 'awaiting_attribute'
  | 'awaiting_name'
  | 'awaiting_fulfillment'
  | 'awaiting_address'
  | 'awaiting_phone'
  | 'awaiting_payment'
  | 'awaiting_notes'
  | 'awaiting_final_confirm'
  | 'confirming'
  | 'awaiting_mp_payment'
  | 'completed'
  | 'closed';

export const EMPTY_SESSION: WhatsappSessionData = {
  cart: [],
  orderType: 'delivery',
  linkedUserId: null,
  linkedUserName: null,
  pendingRedemptionCode: null,
  pendingRedemptionExpiresAt: null,
  fulfillmentChosen: false,
  addressConfirmed: false,
  phoneConfirmed: false,
  contactPhone: null,
  lastDeliveryAddress: null,
};

export type AiOrderAction = {
  addItems?: Array<{
    productId: number;
    quantity?: number;
    note?: string;
    attributes?: { attributeName: string; attributeValue: string }[];
  }>;
  removeProductIds?: number[];
  setCustomerName?: string;
  setAddress?: string;
  setOrderType?: 'delivery' | 'pickup';
  setPaymentMethod?: string;
  setCashChangeFor?: string;
  setCustomerNotes?: string;
  requestConfirm?: boolean;
  requestHuman?: boolean;
  clearCart?: boolean;
};

export type AiTurnResult = {
  reply: string;
  actions?: AiOrderAction;
};
