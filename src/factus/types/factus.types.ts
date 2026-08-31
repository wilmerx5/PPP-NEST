/** Payloads y respuestas Factus API v2 (factura estándar). */

export type FactusPaymentDetail = {
  payment_form: string;
  payment_method_code: string;
  reference_code?: string;
  amount: string;
  due_date?: string;
};

export type FactusCustomer = {
  identification_document_code: string;
  identification: string;
  dv?: string;
  legal_organization_code: string;
  tribute_code?: string;
  responsibilities?: string[];
  company?: string;
  trade_name?: string;
  names?: string;
  address?: string;
  email?: string;
  phone?: string;
  country_code?: string;
  municipality_code?: string;
};

export type FactusItemTax = {
  code: string;
  rate: string;
  is_excluded?: boolean;
};

export type FactusBillItem = {
  code_reference: string;
  name: string;
  quantity: string;
  discount_rate?: string;
  discount_amount?: string;
  price: string;
  unit_measure_code: string;
  standard_code: string;
  note?: string;
  taxes: FactusItemTax[];
};

export type FactusValidateBillRequest = {
  reference_code: string;
  document?: string;
  numbering_range_id?: number;
  operation_type?: string;
  send_email?: boolean;
  observation?: string;
  created_time?: string;
  cash_rounding_amount?: string;
  payment_details: FactusPaymentDetail[];
  customer: FactusCustomer;
  items: FactusBillItem[];
  order_reference?: {
    reference_code: string;
    issue_date?: string;
  };
};

export type FactusValidateBillResponse = {
  status: string;
  message: string;
  data: {
    reference_code: string;
    number: string;
    is_validated: boolean;
    validated_at?: string;
    errors?: Record<string, unknown>;
    cufe?: string;
    links?: {
      qr?: string;
      public_url?: string;
    };
    totals?: {
      gross_amount?: string;
      tax_amount?: string;
      total?: string;
    };
  };
};

export type FactusOAuthTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
};

export type FactusNumberingRange = {
  id: number;
  document?: string;
  prefix?: string;
  from?: number;
  to?: number;
  current?: number;
  is_active?: boolean;
};

export type FactusValidateCreditNoteRequest = {
  reference_code: string;
  correction_concept_code: string;
  customization_id?: string;
  bill_number: string;
  numbering_range_id?: number;
  observation?: string;
  payment_details: FactusPaymentDetail[];
  items: FactusBillItem[];
  customer: FactusCustomer;
};

/** Cliente en GET /v2/bills/:number (estructura anidada Factus). */
export type FactusBillDetailCustomer = {
  identification_document?: { code?: string; name?: string };
  identification?: string;
  dv?: string | null;
  graphic_representation_name?: string;
  trade_name?: string | null;
  company?: string | null;
  names?: string;
  address?: string;
  email?: string;
  phone?: string;
  legal_organization?: { code?: string; name?: string };
  tribute?: { code?: string; name?: string };
  responsibilities?: Array<{ code?: string; name?: string } | string>;
  country?: { code?: string; name?: string };
  municipality?: { code?: string; name?: string };
};

export type FactusBillDetail = {
  reference_code?: string;
  number?: string;
  cufe?: string;
  is_validated?: boolean;
  validated_at?: string;
  created_at?: string;
  total?: string;
  links?: {
    qr?: string;
    public_url?: string;
  };
  customer?: FactusBillDetailCustomer;
};

/** Ítem resumido en GET /v2/bills (listado paginado). */
export type FactusBillListItem = {
  number?: string;
  reference_code?: string;
  total?: string;
  is_validated?: boolean;
  validated_at?: string;
  created_at?: string;
  cufe?: string;
  links?: {
    qr?: string;
    public_url?: string;
  };
  customer?: FactusBillDetailCustomer;
};

export type FactusBillsListResponse = {
  status?: string;
  message?: string;
  data?: {
    data?: FactusBillListItem[];
    current_page?: number;
    last_page?: number;
    total?: number;
  };
};

export type FactusValidateCreditNoteResponse = {
  status: string;
  message: string;
  data: {
    reference_code?: string;
    number?: string;
    is_validated?: boolean;
    cufe?: string;
    errors?: Record<string, unknown>;
    links?: {
      qr?: string;
      public_url?: string;
    };
  };
};

export type FactusDownloadPdfResponse = {
  status?: string;
  message?: string;
  data?: {
    pdf_base_64_encoded?: string;
    file_name?: string;
    number?: string;
  };
};
