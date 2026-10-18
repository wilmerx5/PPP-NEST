import { isFinalConfirmAffirmation } from './whatsapp-session-intents';

/** Only an unquoted, unconditional, declarative clause supplies approval. */
export function hasExplicitOrderApprovalClause(text: string): boolean {
  const source = text.replace(/"[^"\n]*"|“[^”]*”|«[^»]*»|‘[^’]*’|'[^'\n]*'|`[^`]*`/gu, ' [cita] ');
  if (/["“”«»‘’'`]/u.test(source)) return false;
  if (/\b(?:no|sin|antes de)\s+(?:lo\s+)?confirm(?:o|ar|ando)\b|\bsolo si\b/i.test(source)) return false;
  // A standalone "si confirmo el pedido" is a common unaccented yes.
  // The same prefix inside a longer question remains conditional.
  const standalone = source.trim().replace(/[.!]$/, '').trim();
  if (/^si\s+(?:lo\s+)?confirmo(?:\s+(?:el|mi)\s+pedido)?$/i.test(standalone)) return true;
  if (/\b(?:si|en caso de)\s+(?:yo\s+)?(?:lo\s+)?confirm(?:o|ar)\b/i.test(source)) return false;

  const approves = (clause: string) => {
    const raw = clause.trim();
    if (isFinalConfirmAffirmation(raw)) return true;
    let normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().replace(/^(?:por favor|porfa)\s+/, '')
      .replace(/\s+(?:por favor|porfa|gracias)$/, '');
    if (/^sí\s+/i.test(raw)) normalized = normalized.replace(/^si\s+/, '');
    return /^(?:(?:lo |quiero )?(?:confirmar|confirma|confirmo|confirmado|aprobar|apruebo|aprobado|finalizar|terminar|cerrar)(?: (?:el|mi) pedido)?|pedido (?:confirmado|aprobado|listo))$/.test(normalized);
  };

  let clause = '';
  let question = false;
  for (const char of source) {
    if (char === '¿') {
      if (!question && approves(clause)) return true;
      clause = ''; question = true;
    } else if (char === '?') {
      clause = ''; question = false;
    } else if (/[.!;,\n]/.test(char)) {
      if (!question && approves(clause)) return true;
      clause = '';
    } else clause += char;
  }
  return !question && approves(clause);
}

/** Questions, quotes and mentions cannot authorize a broader legacy matcher. */
export function blocksImplicitOrderApproval(text: string): boolean {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const mention = /[¿?"“”«»‘’'`]/u.test(text) ||
    /\b(?:confirmar|confirma|confirmo|confirmado|confirmando|aprobar|apruebo|aprobado)\b/.test(normalized);
  return mention && !hasExplicitOrderApprovalClause(text);
}
