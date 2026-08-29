/**
 * Intents de sesión WhatsApp (puros, testeables).
 * Usar desde el orquestador y desde regresiones de chat.
 */

/** Cliente quiere cambiar domicilio sin pedir platos. */
export function isAddressChangeIntent(text: string): boolean {
  const t = (text || '').trim().toLowerCase();
  if (!t || t.length < 8) return false;
  return (
    /\b(cambia(r|me)?|actualiza(r|me)?|modifica(r|me)?|corrige|corregir)\s+(la\s+)?(direcci[oó]n|domicilio|ubicaci[oó]n)\b/i.test(
      t,
    ) ||
    /\b(la\s+)?(direcci[oó]n|domicilio)\s+(es|queda|ahora|nueva)\b/i.test(t) ||
    /\b(nueva\s+direcci[oó]n|otro\s+domicilio|cambiar\s+domicilio)\b/i.test(t)
  );
}

/** Salir de lista / atributos / multi sin cancelar todo el pedido. */
export function isAbandonPendingSelectionIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/^ya\s+no[\s!.?]*$/.test(t)) return true;
  if (/^(no|nop|nel)[\s!.?]*$/.test(t)) return true;
  if (
    /\b(no\s+lo\s+quiero|no\s+la\s+quiero|no\s+era\s+eso|no\s+es\s+eso|me\s+equivoqu[eé]|olvidalo|olvídalo|olvidate|olvídate|dejalo|d[eé]jalo|cancelalo|cancelala|canc[eé]lalo|quitalo|qu[ií]talo|sacalo|no\s+agregues|no\s+lo\s+agregues)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(cancelar?\s+(eso|este|esta|ese|esa|el\s+producto|la\s+opci[oó]n|el\s+pollo|esa\s+opci[oó]n)|que\s+lo\s+cancel|que\s+la\s+cancel)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(no\s+quiero\s+(?:eso|este|esta|ese|esa|el\s+producto|el\s+pollo|pollo|continuar|seguir|eso\s+del\s+pollo))\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(no\s+quie[ro]+\s+(?:eso|este|esta|ese|el\s+pollo|pollo|broaster))\b/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Con lista pendiente: ¿el número es fila (1..N) o código de menú (ej. 99)?
 * Preferir código si coincide con un ítem y no es el mismo producto que la fila N.
 */
export function resolvePendingListOrMenuCode(opts: {
  bareNum: number | null;
  candidates: Array<{ id: number; code: number }>;
}): 'list_index' | 'menu_code' | null {
  const { bareNum, candidates } = opts;
  if (bareNum == null || !candidates.length) return null;
  const codeHit = candidates.find((c) => Number(c.code) === bareNum);
  if (bareNum >= 1 && bareNum <= candidates.length) {
    const row = candidates[bareNum - 1];
    // "99" con 9 filas donde la fila 9 ≠ cód. 99 → código de menú
    if (codeHit && row.id !== codeHit.id) return 'menu_code';
    return 'list_index';
  }
  if (codeHit || bareNum > candidates.length) return 'menu_code';
  return null;
}
