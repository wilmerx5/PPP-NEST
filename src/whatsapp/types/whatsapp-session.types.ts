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
  /** Ya eligió domicilio vs recojo en este pedido */
  fulfillmentChosen?: boolean;
  /** Dirección ya confirmada (no solo inferida del mensaje) */
  addressConfirmed?: boolean;
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
