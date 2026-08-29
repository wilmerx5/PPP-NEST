/**
 * Parseo de mensajes compuestos (plato + dirección + extras).
 * Puro / testeable — usado por el orquestador.
 */
import { PPP_ZONE_LANDMARK_RE } from './whatsapp-intent';

const STREET_START_RE =
  /\b(?:calle|cll|carrera|cra|av\.?|avenida|diag(?:onal)?|dg|transversal|tv)\b/i;

const ADDR_TAIL_HINT_RE =
  /\b(?:torre|apto|apartamento|interior|int\.?|casa|porter[ií]a|bloque|etapa)\b/i;

/**
 * Si el mensaje trae comida + dirección al final (sin "para"),
 * separa productText / address.
 *
 * Ej: "combo broaster con coca… Calle 6b 81b 51 Torre 4 apto 416"
 * Ej: "arroz paisa Es para parques de Castilla …"
 */
export function splitTrailingEmbeddedAddress(
  text: string,
): { productText: string; address: string } | null {
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (raw.length < 12) return null;

  // "Es para …" / "Sería para …"
  const esPara = raw.match(
    /^(.{3,}?)\s+(?:es\s+para|seria\s+para|ser[ií]a\s+para|para\s+la\s+direcci[oó]n)\s+(.+)$/i,
  );
  if (esPara?.[1] && esPara[2] && esPara[2].trim().length >= 6) {
    const head = esPara[1].replace(/[.,;:\s]+$/g, '').trim();
    const addr = esPara[2].trim();
    if (head.length >= 3 && looksLikeEmbeddedAddress(addr)) {
      return { productText: head, address: addr };
    }
  }

  // Última aparición de calle/carrera/… o landmark de zona
  const streetIdx = lastMatchIndex(raw, STREET_START_RE);
  const zoneIdx = lastMatchIndex(raw, PPP_ZONE_LANDMARK_RE);

  let cut = -1;
  if (streetIdx >= 0 && zoneIdx >= 0) cut = Math.min(streetIdx, zoneIdx);
  else cut = streetIdx >= 0 ? streetIdx : zoneIdx;

  if (cut < 8) return null;

  const head = raw.slice(0, cut).replace(/[.,;:\s]+$/g, '').trim();
  const addr = raw.slice(cut).trim();
  if (head.length < 3 || addr.length < 6) return null;
  if (!looksLikeEmbeddedAddress(addr)) return null;
  // Cabeza debe parecer pedido (no solo saludo)
  if (!/\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|costilla|sobrebarriga|hamburguesa|ajiaco|mondongo|pechuga|alitas?|mojarra|gaseosa|jugo|maduro|arepa|domicilio|regala|envia|manda|quiero|dame|pedi|pido|vende|vendes)\b/i.test(head)) {
    return null;
  }

  return { productText: head, address: addr };
}

function lastMatchIndex(text: string, re: RegExp): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) last = m.index;
  return last;
}

function looksLikeEmbeddedAddress(addr: string): boolean {
  const a = addr.trim();
  if (a.length < 6 || a.length > 160) return false;
  if (STREET_START_RE.test(a) && /\d/.test(a)) return true;
  if (PPP_ZONE_LANDMARK_RE.test(a) && (ADDR_TAIL_HINT_RE.test(a) || /\d/.test(a) || a.split(/\s+/).length >= 2)) {
    return true;
  }
  if (ADDR_TAIL_HINT_RE.test(a) && /\d/.test(a) && a.split(/\s+/).length >= 2) return true;
  return false;
}
