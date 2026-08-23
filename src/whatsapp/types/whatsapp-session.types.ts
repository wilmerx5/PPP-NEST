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
  pendingMatch?: {
    query: string;
    candidates: WhatsappProductCandidate[];
  };
  pendingAttribute?: WhatsappPendingAttribute;
  awaitingField?: 'name' | 'address' | 'payment' | 'confirm';
  linkedUserId?: string | null;
  linkedUserName?: string | null;
};

export type WhatsappConversationState =
  | 'building_cart'
  | 'awaiting_name'
  | 'awaiting_address'
  | 'awaiting_payment'
  | 'confirming'
  | 'awaiting_mp_payment'
  | 'completed';

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
  requestConfirm?: boolean;
  requestHuman?: boolean;
  clearCart?: boolean;
};

export type AiTurnResult = {
  reply: string;
  actions?: AiOrderAction;
};
