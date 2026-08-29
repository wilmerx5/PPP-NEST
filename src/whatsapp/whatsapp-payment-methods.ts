export type WhatsappPaymentFlow = 'immediate' | 'mercadopago';

/** Método de pago configurable desde el admin. */
export type WhatsappPaymentMethodConfig = {
  /** Slug estable: cash | transfer | mercadopago | custom_… */
  id: string;
  enabled: boolean;
  /** Nombre corto para resúmenes / cocina */
  label: string;
  /** Palabras que el cliente puede escribir */
  keywords: string[];
  /** Línea en "¿Cómo pagas?" — ej. *contraentrega* (efectivo al recibir) */
  optionText: string;
  /**
   * Mensaje tras elegir el método (datos de transferencia, etc.).
   * Placeholders: {label} {transferInfo} {paymentInstructions} {brand}
   */
  confirmReply?: string;
  flow: WhatsappPaymentFlow;
};

export const DEFAULT_PAYMENT_METHODS: WhatsappPaymentMethodConfig[] = [
  {
    id: 'cash',
    enabled: true,
    label: 'Contraentrega',
    keywords: ['contraentrega', 'contra entrega', 'efectivo', 'cash', 'en efectivo'],
    optionText: '*contraentrega* (efectivo al recibir)',
    confirmReply: '',
    flow: 'immediate',
  },
  {
    id: 'transfer',
    enabled: true,
    label: 'Transferencia',
    keywords: ['transferencia', 'transferir', 'nequi', 'daviplata', 'llave', 'bancolombia', 'consignacion', 'consignación'],
    optionText: '*transferencia* (Nequi / llave / banco)',
    confirmReply:
      'Perfecto, queda como *transferencia*.\n\n{transferInfo}\n\nCuando pagues puedes mandar el comprobante por aquí.',
    flow: 'immediate',
  },
  {
    id: 'mercadopago',
    enabled: true,
    label: 'Mercado Pago',
    keywords: ['mercado pago', 'mercadopago', 'tarjeta', 'link de pago', 'mp'],
    optionText: '*mercado pago* (link de pago)',
    confirmReply: '',
    flow: 'mercadopago',
  },
];

function slugifyId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function normalizeKeyword(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizePaymentMethodsInput(
  input: unknown,
  opts?: { allowMercadoPago?: boolean },
): WhatsappPaymentMethodConfig[] {
  if (!Array.isArray(input) || !input.length) {
    return resolvePaymentMethods(null, opts);
  }

  const out: WhatsappPaymentMethodConfig[] = [];
  const usedIds = new Set<string>();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    let id = slugifyId(String(row.id || row.label || '').trim());
    if (!id) continue;
    if (usedIds.has(id)) id = `${id}_${out.length + 1}`;
    usedIds.add(id);

    const label = String(row.label || id).trim().slice(0, 80) || id;
    const keywordsRaw = Array.isArray(row.keywords)
      ? row.keywords.map((k) => String(k).trim()).filter(Boolean)
      : String(row.keywords || '')
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
    const keywords = [...new Set(keywordsRaw.map(normalizeKeyword).filter(Boolean))].slice(0, 20);
    if (!keywords.length) keywords.push(normalizeKeyword(label));

    const flow: WhatsappPaymentFlow =
      row.flow === 'mercadopago' || id === 'mercadopago' ? 'mercadopago' : 'immediate';

    out.push({
      id,
      enabled: row.enabled !== false,
      label,
      keywords,
      optionText: String(row.optionText || `*${keywords[0] || label}*`).trim().slice(0, 200),
      confirmReply: String(row.confirmReply ?? '').trim().slice(0, 1500),
      flow,
    });
  }

  if (!out.length) return resolvePaymentMethods(null, opts);

  // Si MP está deshabilitado a nivel flag, forzar off en ese método
  if (opts?.allowMercadoPago === false) {
    for (const m of out) {
      if (m.flow === 'mercadopago' || m.id === 'mercadopago') m.enabled = false;
    }
  }

  return out;
}

/**
 * Métodos efectivos: JSON guardado o defaults.
 * `allowMercadoPago` mantiene compatibilidad con el checkbox viejo.
 */
export function resolvePaymentMethods(
  stored: unknown,
  opts?: { allowMercadoPago?: boolean },
): WhatsappPaymentMethodConfig[] {
  const allowMp = opts?.allowMercadoPago !== false;
  let list: WhatsappPaymentMethodConfig[];

  if (Array.isArray(stored) && stored.length) {
    list = sanitizePaymentMethodsInput(stored, { allowMercadoPago: allowMp });
  } else {
    list = DEFAULT_PAYMENT_METHODS.map((m) => ({
      ...m,
      keywords: [...m.keywords],
      enabled: m.flow === 'mercadopago' ? allowMp : m.enabled,
    }));
  }

  return list;
}

export function getEnabledPaymentMethods(
  methods: WhatsappPaymentMethodConfig[],
): WhatsappPaymentMethodConfig[] {
  return methods.filter((m) => m.enabled);
}

export function findPaymentMethodByText(
  text: string,
  methods: WhatsappPaymentMethodConfig[],
): WhatsappPaymentMethodConfig | null {
  const t = normalizeKeyword(text);
  if (!t) return null;
  const enabled = getEnabledPaymentMethods(methods);

  let best: { m: WhatsappPaymentMethodConfig; score: number } | null = null;
  for (const m of enabled) {
    for (const kw of m.keywords) {
      const k = normalizeKeyword(kw);
      if (!k) continue;
      let score = 0;
      if (t === k) score = 100;
      else if (t.includes(k)) score = 80 + Math.min(15, k.length);
      else if (k.includes(t) && t.length >= 4) score = 60;
      if (score > 0 && (!best || score > best.score)) best = { m, score };
    }
  }
  return best && best.score >= 60 ? best.m : null;
}

export function buildPaymentOptionsPrompt(
  methods: WhatsappPaymentMethodConfig[],
  globalHint?: string | null,
): string {
  const enabled = getEnabledPaymentMethods(methods);
  if (!enabled.length) {
    return 'Por ahora no hay métodos de pago configurados. Escribe *humano* y te ayudamos.';
  }
  const lines = enabled.map((m, i) => `${i + 1}. ${m.optionText || `*${m.keywords[0] || m.label}*`}`);
  let msg = `¿Cómo pagas?\n${lines.join('\n')}`;
  if (globalHint?.trim()) msg += `\n\n_${globalHint.trim()}_`;
  return msg;
}

export function paymentMethodLabel(
  methodId: string | undefined,
  methods: WhatsappPaymentMethodConfig[],
): string {
  if (!methodId) return '(pendiente)';
  const found = methods.find((m) => m.id === methodId);
  return found?.label || methodId;
}

export function applyPaymentReplyTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
