/**
 * Intents de sesión WhatsApp (puros, testeables).
 * Usar desde el orquestador y desde regresiones de chat.
 */

/** Cliente quiere cambiar domicilio sin pedir platos. */
export function isAddressChangeIntent(text: string): boolean {
  const t = (text || '').trim().toLowerCase();
  if (!t || t.length < 8) return false;
  if (isAddressRejectionIntent(t)) return true;
  return (
    /\b(cambia(r|me)?|actualiza(r|me)?|modifica(r|me)?|corrige|corregir)\s+(la\s+)?(direcci[oó]n|direcion|domicilio|ubicaci[oó]n)\b/i.test(
      t,
    ) ||
    /\b(la\s+)?(direcci[oó]n|direcion|domicilio)\s+(es|queda|ahora|nueva)\b/i.test(t) ||
    /\b(nueva\s+direcci[oó]n|otro\s+domicilio|cambiar\s+domicilio)\b/i.test(t)
  );
}

/**
 * Rechazo de domicilio anotado: "no esa no es mi dirección", "dirección incorrecta".
 * No trae la dirección nueva todavía.
 */
export function isAddressRejectionIntent(text: string): boolean {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bdirecion\b/g, 'direccion');
  if (!t || t.length < 8) return false;
  // Si ya trae calle/carrera/#, es cambio con destino, no solo rechazo
  if (
    /\b(calle|carrera|cra|cll|av\.?|avenida|diag|torre|apto|apartamento|conjunto)\b/.test(t) &&
    /\d/.test(t)
  ) {
    return false;
  }
  if (
    /\bno\s+(esa|eso|esta|este)\s+no\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t)
  ) {
    return true;
  }
  if (/\bno\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t)) return true;
  if (
    /\b(esa|eso|esta|este)\s+no\s+es\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(direccion|domicilio)\s+(incorrect[ao]|equivocad[ao]|mal|errada)\b/.test(t)
  ) {
    return true;
  }
  if (/^no[,.]?\s+(esa|eso)\s+no\s+es\b/.test(t) && /\b(direccion|domicilio|direcion)\b/.test(t)) {
    return true;
  }
  return false;
}

/**
 * Cliente aclara que el mensaje anterior SÍ era la dirección
 * ("esa era mi dirección") — no un plato/código.
 */
export function isAddressClarificationIntent(text: string): boolean {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bdirecion\b/g, 'direccion');
  if (!t || t.length < 10) return false;
  if (isAddressRejectionIntent(t)) return false;
  return (
    /\b(esa|eso|esta|este)\s+(era|es|fue)\s+(mi\s+)?(direccion|domicilio|ubicacion)\b/.test(t) ||
    /\b(era|es)\s+(mi\s+)?(direccion|domicilio)\b/.test(t) ||
    /\bte\s+(pas[eé]|mand[eé]|envi[eé])\s+(la\s+)?(direccion|domicilio)\b/.test(t)
  );
}

/**
 * Tras pedido completado: ETA / demora / “ya llegó” / cancelar en ruta.
 * NO reabrir carrito ni buscar platos.
 */
export function isPostOrderFollowUpIntent(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 3) return false;
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Pedido nuevo claro → no es seguimiento
  if (
    /\b(quiero|dame|ponme|regala|pedi|pido|ordenar|me\s+envias|me\s+mandas)\b/.test(t) &&
    /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa|ajiaco|mondongo|gaseosa)\b/.test(
      t,
    )
  ) {
    return false;
  }

  if (
    /\b(se\s+demora|esta\s+demorado|esta\s+demorada|muy\s+demorado|cuanto\s+(tiempo|se\s+tarda|tarda)|en\s+cuanto\s+(llega|llegaria|llegara)|cuando\s+(llega|sale|salen)|ya\s+(salio|salieron|va\s+en\s+camino|esta\s+en\s+camino|debe\s+estar)|nada\s+que\s+llega|van\s+a\s+llegar\s+frias|ya\s+vamos\s+(una\s+hora|para\s+mas)|me\s+tengo\s+que\s+ir|mejor\s+(lo\s+)?cancelo|cancelarl[oa]|va\s+(a\s+)?tocar\s+cancel|cancelar?\s+(el\s+)?pedido|ya\s+salieron\s+para\s+aca)\b/.test(
      t,
    )
  ) {
    return true;
  }

  if (/\bya\s+lleg[oó]\b/.test(t) && t.length <= 40) {
    return true;
  }

  if (
    /\b(trajo\s+(un|el|otro)|no\s+me\s+(regalaron|trajeron|enviaron)|falto|me\s+falta)\b/.test(t)
  ) {
    return true;
  }

  return false;
}

/**
 * Confirmar dirección sugerida / última guardada: “sí”, “acá”, “la misma”.
 */
export function isReuseLastAddressIntent(text: string): boolean {
  const t = (text || '').trim().toLowerCase();
  if (!t || t.length > 40) return false;
  if (
    /^(si|sí|sep|ok|okay|dale|listo|correcto|exacto|esa|esa misma|confirmo)([\s!.?]*|(\s+por\s+fa(vor|fa)?[\s!.?]*))$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/^(aca|acá|ahi|ahí|alli|allí|aqui|aquí)([\s!.?]*|(\s+si[\s!.?]*))$/i.test(t)) {
    return true;
  }
  if (
    /^(la\s+misma(\s+direcci[oó]n)?|misma\s+direcci[oó]n|la\s+de\s+siempre|la\s+anterior)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** “¿Cuánto demora?” / “en cuánto llega?” — ETA de domicilio. */
export function isDeliveryEtaInquiry(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 6) return false;

  // Pedido concreto → no solo ETA
  if (
    /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar)\b/i.test(raw) &&
    /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa)\b/i.test(raw)
  ) {
    return false;
  }

  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    /\b(se\s+demora|cuanto\s+(se\s+)?(demora|tarda|tardaria)|cuanto\s+tiempo|en\s+cuanto\s+(llega|llegaria|llegara|sale|salen)|cuando\s+(llega|llegaria)|tiempo\s+de\s+(domicilio|entrega|espera)|demora\s+(el\s+)?(domicilio|pedido|envio)|eta)\b/.test(
      t,
    ) ||
    /\b(cuanto|cuanto\s+aprox)\b.+\b(minutos?|mins?|demora|lleg)\b/.test(t)
  );
}

/**
 * Solo pregunta de cobertura: “¿tienen domicilios para Cra 81A…?”
 * (sin estar pidiendo platos).
 */
export function isDeliveryCoverageInquiry(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 12) return false;

  const orderingFood =
    /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar|un\s+pollo|una\s+sopa|combo\s+de|ejecutivo|arroz\s+con)\b/i.test(
      raw,
    );
  if (orderingFood) return false;

  if (/\b(domicilios?|entregas?)\s+(para|a|en|hasta)\b/i.test(raw)) return true;

  if (
    /\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
    /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
    /\b(para|a|en|hasta|por)\b/i.test(raw)
  ) {
    return true;
  }

  if (
    /\b(hacen|tienen)\s+(servicio\s+a\s+)?domicilio\b/i.test(raw) &&
    /\b(para|a|en|hasta)\b/i.test(raw)
  ) {
    return true;
  }

  return false;
}

/** Extrae la dirección de una pregunta de cobertura. */
export function extractCoverageAddressProbe(text: string): string | null {
  const raw = (text || '').trim();
  if (!raw) return null;

  const patterns = [
    /\b(?:domicilios?|entregas?|env[ií]os?|servicio\s+a\s+domicilio)\s+(?:para|a|en|hasta)\s+(.+?)[\s?!.]*$/i,
    /\b(?:para|a|en|hasta)\s+((?:calle|carrera|cra|cll|dg|diagonal|av\.?|avenida|conjunto|torre|barrio)\b.+?)[\s?!.]*$/i,
    /\b(?:para|a|en|hasta)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9].{5,90})[\s?!.]*$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const addr = m[1]
        .replace(/\b(por\s+favor|porfa|gracias|ok|vale)\b/gi, '')
        .replace(/[?!.]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (addr.length >= 6) return addr;
    }
  }
  return null;
}

/** Salir de lista / atributos / multi sin cancelar todo el pedido. */
export function isAbandonPendingSelectionIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Saludo suelto mientras hay selección pendiente = salir del atrape
  if (
    /^(hola|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|hi)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  // Reinicio / reset (también vacía vía clearCart; aquí suelta pending si llega antes)
  if (/^(reinicio|reiniciar|reinicia|reset|resetear|resetea)[\s!.?]*$/i.test(t)) {
    return true;
  }
  // "pollo no" / "no pollo" mientras pide arepas del #1
  if (/^(pollo\s+no|no\s+(el\s+)?pollo|no\s+quiero\s+(el\s+)?pollo)[\s!.?]*$/i.test(t)) {
    return true;
  }
  if (/^ya\s+no[\s!.?]*$/.test(t)) return true;
  if (/^(no|nop|nel)[\s!.?]*$/.test(t)) return true;
  if (/\bya\s+no\s+(quiero|deseo|pido|me\s+interesa)\b/.test(t)) return true;
  if (/\bno\s+eso\s+no\s+es\b/.test(t) || /\bno\s+esa\s+no\s+es\b/.test(t)) return true;
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
    /\b(no\s+quiero\s+(?:eso|este|esta|ese|esa|el\s+producto|el\s+pollo|pollo|continuar|seguir|eso\s+del\s+pollo|la\s+sopa\s+peque[nñ]a|sopa\s+peque[nñ]a))\b/.test(
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
