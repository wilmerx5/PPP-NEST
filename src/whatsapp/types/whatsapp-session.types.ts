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
};

export type WhatsappSessionData = {
  cart: WhatsappCartItem[];
  orderType: 'delivery' | 'pickup';
  address?: string;
  paymentMethod?: 'cash' | 'mercadopago';
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
  pendingAttribute?: WhatsappPendingAttribute;
  awaitingField?: 'name' | 'address' | 'payment' | 'notes' | 'confirm';
  linkedUserId?: string | null;
  linkedUserName?: string | null;
};

export type WhatsappConversationState =
  | 'building_cart'
  | 'awaiting_attribute'
  | 'awaiting_name'
  | 'awaiting_address'
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
  setPaymentMethod?: 'cash' | 'mercadopago';
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
