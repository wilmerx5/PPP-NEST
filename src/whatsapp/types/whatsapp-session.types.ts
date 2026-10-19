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
  /** Original cart line retained until a variant replacement is complete. */
  replacement?: { originalLine: WhatsappCartItem };
  /** Explicit correction while the product options are still pending. */
  quantity?: number;
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
  /** One reversible drink addition, valid only while the cart signature matches. */
  lastDrinkAddition?: { productId: number; beforeCart: WhatsappCartItem[]; cartSignature: string };

  /** Read-only price clarification, separate from an order selection. */
  pendingPriceInquiry?: { cartSignature: string; state: string; productIds: number[] };
  pendingCartAttributeEdit?: {
    sourceText: string;
    cartSignature: string;
    candidates: Array<{cartIndex: number; name: string; sourceText?: string}>;
  };
  pendingCartQuantity?: {
    quantity: number;
    options: Array<{ cartIndex: number; label: string }>;
    cartSignature: string;
  };
  /** Subset instruction awaits recipients; an empty note awaits preparation for named products. */
  pendingSubsetKitchenNote?: { quantity: number; note: string; productIds: number[]; byProduct?: boolean };
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
  /** A product list left without a pick; recalled once before the final summary. */
  droppedPick?: { query: string; candidates: WhatsappProductCandidate[]; shown?: boolean };
  pendingMatch?: {
    /** A retained browse list after its chosen item was already added. */
    selectionAdded?: boolean;
    query: string;
    candidates: WhatsappProductCandidate[];
    /** info = eligió variante para ver detalle (no agregar al carrito) */
    intent?: 'info' | 'order';
    /** Cantidad pedida al elegir de la lista (ej. 5 pollos) */
    quantity?: number;
    /** Explicit quantity replacement before selecting a candidate. */
    correctedQuantity?: number;
    /** Cart line replaced when the customer picks one of these options. */
    replacement?: { originalLine: WhatsappCartItem };
    /** Otros platos del mismo mensaje, se agregan al elegir esta lista. */
    alsoAdd?: Array<{ productId: number; segment: string }>;
    /** Preparation the customer gave for the dish still being chosen. */
    note?: string;
  };
  /**
   * "Uno con …" y luego "el otro con …" llegan antes de cerrar el plato.
   * Se reparte cuando el producto ya está en el carrito.
   */
  pendingUnitSplit?: string;
  /** Varios platos en un mensaje: confirmar o resolver dudas antes de agregar. */
  /** Read-only context for a follow-up about unavailable items; never a purchase draft. */
  recentUnavailableOrder?: { items: string[]; expiresAt: number };
  /** Productos reconocidos en la última foto, en el orden en que aparecieron. */
  recentImageOrder?: Array<{ productId: number; name: string }>;
  /** Snapshot before image additions, used to protect independently ordered units. */
  recentImageCartBefore?: WhatsappCartItem[];
  /** Only image product lines after a successful image turn or correction. */
  recentImageCartSignature?: string;
  /** Resume the interrupted checkout field after a catalog purchase or replacement. */
  pendingCheckoutResume?: 'awaiting_address' | 'awaiting_name' | 'awaiting_phone' | 'awaiting_payment' | 'awaiting_final_confirm';
  pendingMultiOrder?: {
    confident: Array<{
      segment: string;
      productId: number;
      name: string;
      code: number;
      price: number;
      note?: string;
    }>;
    ambiguous: Array<{
      segment: string;
      candidates: WhatsappProductCandidate[];
      note?: string;
    }>;
    needsAttributes: Array<{
      segment: string;
      productId: number;
      name: string;
      code: number;
      price: number;
      note?: string;
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
  /** Opción de una lista que se acaba de describir. «Sí, ese» compra solo esta. */
  describedListCandidateId?: number;
  /** A replacement needs one original cart line; choosing it must not delete it alone. */
  pendingCartReplacement?: {
    cartSignature: string;
    options: Array<{ cartIndex: number; label: string }>;
    addQuery: string;
  };
  /** El cliente pidió quitar algo ambiguo: elige línea del carrito por número. */
  pendingCartRemoval?: {
    cartSignature?: string;
    options: Array<{ cartIndex: number; label: string }>;
  };
  /**
   * Tras cotizar precio (“¿Te lo agrego?”): si responde *sí*, agregar este SKU.
   */
  /**
   * El cliente quiere cambiar un acompañamiento que el plato sí trae
   * por algo que esa sopa o ese plato no incluye. Sí agrega la porción aparte.
   */
  pendingSideSwap?: {
    cartIndex: number;
    productId: number;
    removeSide: string;
    /** "en todos los platos": every line that carries the side. */
    cartIndexes?: number[];
    addProductId?: number;
    addUnitPrice?: number;
    /** Older pending offers without a signature must be re-confirmed. */
    cartSignature?: string;
  };
  pendingAddOffer?: {
    productId: number;
    name: string;
    code: number;
    price: number;
    quantity: number;
    /** Texto original de la consulta (attrs / multi al decir *sí*) */
    sourceText?: string;
    /** Varios SKUs cotizados juntos (sí → agregar todos) */
    productIds?: number[];
  };
  /**
   * Preguntamos “¿de qué plato?” (acompañamiento/ingredientes) y esperamos el nombre.
   * El siguiente plato nombrado → detalle, NO agregar al carrito.
   */
  pendingCompositionAsk?: {
    originalText: string;
    /** A read-only interruption must return to the original data/option step. */
    resumeState?: string;
    productIds?: number[];
  };
  /**
   * Pedimos el # de orden (estado / demora sin contexto).
   * El próximo mensaje con número resuelve el lookup.
   */
  pendingOrderStatusLookup?: boolean;
  /** Ya eligió domicilio vs recojo en este pedido */
  fulfillmentChosen?: boolean;
  /** Dirección ya confirmada (no solo inferida del mensaje) */
  addressConfirmed?: boolean;
  /** Unit fragment received before the destination street/location. Never geocode alone. */
  pendingDeliveryUnit?: string;
  /** Do not reoffer a saved destination after the customer requested a new one. */
  freshDeliveryAddressRequested?: boolean;
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
  removeCartLines?: Array<{ productId: number; cartLineIndex: number }>;
  updateCartLines?: Array<{
    productId: number;
    cartLineIndex: number;
    quantity?: number;
    /** Replacement note; empty string clears it. */
    note?: string;
  }>;
  /** One subset per original cart row; all attributes apply to the same units. */
  updateUnitOptions?: Array<{
    productId: number;
    cartLineIndex: number;
    affectedQuantity: number;
    /** Note for this subset; append by default, with explicit replacement/clear modes. */
    note?: string;
    noteMode?: 'append' | 'replace' | 'clear';
    attributes: Array<{ attributeName: string; attributeValue: string }>;
  }>;
  updateAttributes?: Array<{
    productId: number;
    cartLineIndex?: number;
    attributeName: string;
    attributeValue: string;
  }>;
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
