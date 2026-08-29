/**
 * Clasificación temprana de mensaje WhatsApp (IA + reglas).
 * La IA propone; el backend valida y ejecuta.
 */

export type WhatsappClassifyIntent =
  | 'delivery_setup'
  | 'address'
  | 'order'
  | 'question'
  | 'chitchat'
  | 'other';

export type WhatsappClassifyResult = {
  intent: WhatsappClassifyIntent;
  /** Texto con typos corregidos (ej. domickio → domicilio) */
  normalizedText: string;
  /** Dirección si la hay (setup o address) */
  address: string | null;
  /** Hay plato(s) de comida en el mensaje */
  hasFoodItems: boolean;
  confidence: number;
};

const FOOD_HINT_RE =
  /\b(pollo|sopa|bandeja|mojarra|churrasco|hamburguesa|ajiaco|mondongo|gaseosa|limonada|broaster|arepa|combo|ejecutivo|arroz|costilla|pechuga|alitas?|sobrebarriga|chino|paisa|maduro|frito|asado|medio|cuarto)\b/i;

const LOGISTICS_HINT_RE =
  /\b(domicil|direcci|delivery|bosques?|castilla|tabaku|nuevo\s+sol|altavista|torre|apto|apartamento|calle|carrera|cra|porter[ií]a|conjunto|habitaci)\b/i;

/** ¿Vale la pena gastar un classify IA? (barato: no en códigos/confirmaciones claras). */
export function needsAiMessageClassify(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 6) return false;
  if (/^\d{1,4}$/.test(raw)) return false;
  if (
    /^(listo|ok|dale|confirmar|confirmo|s[ií]|no|gracias|hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches)[\s!.?]*$/i.test(
      raw,
    )
  ) {
    return false;
  }

  const hasFood = FOOD_HINT_RE.test(raw);
  const hasLogistics = LOGISTICS_HINT_RE.test(raw) || hasFuzzyDomicilioCandidate(raw);

  // Logística sin comida, o mezcla (todo-en-uno), o coma rara sin comida clara
  if (hasLogistics && !hasFood) return true;
  if (hasLogistics && hasFood) return true;
  if (/,/.test(raw) && !hasFood && raw.length >= 12) return true;
  if (hasFuzzyDomicilioCandidate(raw)) return true;

  return false;
}

export function hasFuzzyDomicilioCandidate(text: string): boolean {
  const words = (text || '').toLowerCase().match(/[a-záéíóúüñ]{6,14}/gi) || [];
  for (const w of words) {
    const n = normalizeWord(w);
    if (n === 'domicilio' || n === 'domicilios') continue;
    if (!n.startsWith('d')) continue;
    if (editDistance(n, 'domicilio') <= 2 || editDistance(n, 'domicilios') <= 2) {
      return true;
    }
  }
  return false;
}

export function parseClassifyResult(
  raw: unknown,
  fallbackText: string,
): WhatsappClassifyResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const intentRaw = String(o.intent || '').toLowerCase().trim();
  const allowed: WhatsappClassifyIntent[] = [
    'delivery_setup',
    'address',
    'order',
    'question',
    'chitchat',
    'other',
  ];
  if (!allowed.includes(intentRaw as WhatsappClassifyIntent)) return null;

  const normalizedText =
    typeof o.normalizedText === 'string' && o.normalizedText.trim()
      ? o.normalizedText.trim().slice(0, 500)
      : fallbackText;
  const address =
    typeof o.address === 'string' && o.address.trim().length >= 4
      ? o.address.trim().slice(0, 200)
      : null;
  const hasFoodItems = o.hasFoodItems === true;
  const confidence =
    typeof o.confidence === 'number' && Number.isFinite(o.confidence)
      ? Math.max(0, Math.min(1, o.confidence))
      : 0.5;

  return {
    intent: intentRaw as WhatsappClassifyIntent,
    normalizedText,
    address,
    hasFoodItems,
    confidence,
  };
}

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(cols);
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[cols - 1];
}

/** Corrige tokens a ~2 edits de domicilio/domicilios. */
export function fixFuzzyDomicilioTypos(text: string): string {
  return (text || '').replace(/\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{6,14}\b/g, (word) => {
    const n = normalizeWord(word);
    if (n === 'domicilio' || n === 'domicilios') return word;
    if (!n.startsWith('d')) return word;
    // Evitar tocar palabras ajenas (domingo, document, etc.)
    if (!/^dom|^dmi|^dcm|^dmo|^domi|^domc|^domk|^doml/.test(n) && !n.includes('micil')) {
      // domickio, domicikio, etc. suelen empezar por dom
      if (editDistance(n, 'domicilio') > 2 && editDistance(n, 'domicilios') > 2) {
        return word;
      }
    }
    const d1 = editDistance(n, 'domicilio');
    const d2 = editDistance(n, 'domicilios');
    if (d1 === 0 || d2 === 0) return word;
    if (d1 <= 2 && d1 <= d2) return 'domicilio';
    if (d2 <= 2) return 'domicilios';
    return word;
  });
}
