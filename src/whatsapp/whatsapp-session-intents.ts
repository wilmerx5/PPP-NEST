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
 * “Se cortó la llamada / ¿alcanzaron a tomar el pedido?” —
 * validar orden existente, NO armar domicilio nuevo.
 */
export function isInterruptedPhoneOrderInquiry(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 12) return false;
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Pedido nuevo claro con plato → no es consulta de orden cortada
  if (
    /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar)\b/.test(t) &&
    /\b(pollo|arroz|sopa|combo|bandeja|ejecutivo|churrasco|hamburguesa|ajiaco|mondongo|gaseosa)\b/.test(
      t,
    )
  ) {
    return false;
  }

  const callCut =
    /\b(se\s+corto|se\s+cortaron|cortaron|cayo\s+la\s+llamada|se\s+cayo)\b/.test(t) &&
    /\b(llamada|llamado|telefono|celular)\b/.test(t);

  const validateTaken =
    /\b(alcanzaron\s+a\s+tomar|alcanzo\s+a\s+tomar|lo\s+tomaron|qued[oó]\s+(registrado|tomado|el\s+pedido)|validar?\s+(si\s+)?(el\s+)?pedido|si\s+(ya\s+)?(lo\s+)?(tomaron|registraron|anotaron))\b/.test(
      t,
    );

  const wasOrdering =
    /\b(estaba\s+pidiendo|estoy\s+pidiendo|pedi\s+por\s+(llamada|telefono)|pedido\s+por\s+(llamada|telefono))\b/.test(
      t,
    );

  if (callCut && (/\b(pedido|domicilio|orden)\b/.test(t) || validateTaken || wasOrdering)) {
    return true;
  }
  if (validateTaken && (/\b(llamada|telefono|pedido|domicilio|orden)\b/.test(t) || wasOrdering)) {
    return true;
  }
  if (wasOrdering && (callCut || validateTaken || /\b(validar|confirmar|revisar)\b/.test(t))) {
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

/**
 * Cliente confirma el domicilio YA anotado (“a esta dirección plis”),
 * no está dando una dirección nueva.
 */
export function isConfirmCurrentAddressIntent(text: string): boolean {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bdirecion\b/g, 'direccion')
    .replace(/[¡!?.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length < 5 || t.length > 72) return false;
  // Si trae calle/placa, es dirección real (o cambio), no solo confirmación
  if (
    /\b(calle|carrera|cra|cll|av\.?|avenida|diag|dg|transversal|torre|apto|apartamento|conjunto)\b/.test(
      t,
    ) &&
    /\d/.test(t)
  ) {
    return false;
  }
  if (isAddressRejectionIntent(t) || isAddressChangeIntent(t)) return false;

  const courtesy = String.raw`(?:\s+(?:plis|porfa|por\s+favor|please|gracias))?`;
  return (
    new RegExp(
      String.raw`^(?:(?:si|sí|ok|dale|listo)\s+)?(?:a|para)\s+(?:esta|esa|la\s+misma)\s+(?:direccion|domicilio|ubicacion)${courtesy}$`,
    ).test(t) ||
    new RegExp(
      String.raw`^(?:esta|esa|la\s+misma)\s+(?:direccion|domicilio|ubicacion)${courtesy}$`,
    ).test(t) ||
    new RegExp(
      String.raw`^(?:envia(?:me|lo|nos)?|manda(?:me|lo|nos)?|lleva(?:me|lo|nos)?|trae(?:me|lo)?)\s+(?:a\s+)?(?:esta|esa)\s+(?:direccion|domicilio)${courtesy}$`,
    ).test(t) ||
    new RegExp(
      String.raw`^(?:a|para)\s+(?:esa|esta|ahi|alla)${courtesy}$`,
    ).test(t)
  );
}

/**
 * Nombre usable para cocina/FE (no placeholders tipo “Pedidos”, “Cliente”).
 */
export function isUsableWhatsappCustomerName(name: string): boolean {
  const raw = (name || '').trim();
  if (raw.length < 2 || raw.length > 80) return false;

  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (/\d{3,}/.test(t)) return false;
  if (
    /\b(calle|carrera|cra|cll|domicilio|direccion|whatsapp|telefono|celular)\b/.test(t)
  ) {
    return false;
  }

  const blockedExact = new Set([
    'pedido',
    'pedidos',
    'cliente',
    'clientes',
    'customer',
    'user',
    'usuario',
    'admin',
    'test',
    'prueba',
    'whatsapp',
    'ppp',
    'pronto',
    'pollo',
    'portal',
    'delivery',
    'domicilio',
    'nombre',
    'sin nombre',
    'n a',
    'na',
    'none',
    'null',
    'undefined',
    'asd',
    'qwerty',
    // Verbos / muletillas que el parser a veces toma como nombre ("Necesito un domicilio")
    'necesito',
    'quiero',
    'quería',
    'queria',
    'dame',
    'ponme',
    'pido',
    'pedi',
    'regalame',
    'regáleme',
    'hola',
    'buenas',
    'buenos',
    'tardes',
    'dias',
    'días',
    'seria',
    'querria',
    'regalas',
    'regala',
  ]);
  if (blockedExact.has(t)) return false;
  if (
    /^(necesito|quiero|queria|seria|dame|ponme|pido|pedi|regalame|regalas|regala|para|hacer|buenas|buenos|hola)\b/.test(
      t,
    )
  ) {
    return false;
  }
  // "Me regalas", "me das", "me puedes…" — cortesía, no nombre
  if (
    /^me\s+(regalas?|das|pones|mandas|traes|puedes|colaboras|ayudas|envias|envías)\b/.test(t)
  ) {
    return false;
  }
  // "Para hacer", "para pedir", "quiero domicilio", "seria un combo"…
  if (
    /\b(hacer|pedir|ordenar|domicilio|pedido|orden|combo|pollo|arroz|regalas?)\b/.test(t) &&
    /^(para|quiero|necesito|voy|vengo|me|seria)\b/.test(t)
  ) {
    return false;
  }
  if (/^(pronto\s+pollo(\s+portal)?|ppp\s+pedidos?)$/.test(t)) return false;
  if (/^pedidos?\b/.test(t) && t.split(' ').length <= 2) return false;

  return true;
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
    /\b(cuanto|cuanto\s+aprox|mas\s*o?\s*menos|masomenos|aprox(?:imadamente)?)\b.+\b(minutos?|mins?|demora|tarda|lleg)\b/.test(
      t,
    ) ||
    /\b(mas\s*o?\s*menos|masomenos|aprox(?:imadamente)?)\s+cuanto\b/.test(t)
  );
}

/**
 * Pregunta por UN pedido concreto (estado / “mi orden”) vs tiempo genérico de domicilio.
 * Sin contexto → pedir número de orden.
 */
export function isSpecificOrderProgressInquiry(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 4) return false;
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // "Quiero terminar mi pedido" = checkout del carrito, no estado de orden ya hecha
  if (
    /\b(terminar|cerrar|finalizar|completar|confirmar)\s+(el\s+|mi\s+|este\s+)?pedido\b/.test(
      t,
    ) ||
    /\b(quiero|vamos\s+a|deseo|necesito)\s+(terminar|cerrar|finalizar|completar|confirmar)\b/.test(
      t,
    ) ||
    /^(ya\s+)?(eso\s+)?es\s+todo$/.test(t) ||
    /^(eso\s+todo|listo\s+es\s+todo|ya\s+todo)$/.test(t) ||
    /^(asi\s+)?nada\s+mas$/.test(t) ||
    /^(eso\s+es\s+todo|solo\s+eso)$/.test(t)
  ) {
    return false;
  }

  if (extractDailyOrderNumberHint(raw) != null) return true;

  if (
    /\b(mi\s+pedido|el\s+pedido|mi\s+orden|la\s+orden|mi\s+compra|el\s+#\s*\d+)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(en\s+que\s+(va|esta|andan)|donde\s+(va|esta|andan)|ya\s+(salio|salieron|va\s+en\s+camino|esta\s+en\s+camino)|estado\s+(del?\s+)?(pedido|orden)|ubicar\s+(al\s+)?domiciliario)\b/.test(
      t,
    )
  ) {
    return true;
  }
  // ETA + referencia a pedido/orden
  if (
    isDeliveryEtaInquiry(raw) &&
    /\b(pedido|orden|ordenes|domiciliario|repartidor|mi\s+comida)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Extrae #15 / orden 15 / pedido 15 del texto (número diario). */
export function extractDailyOrderNumberHint(text: string): number | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  const m =
    raw.match(/\b(?:orden|pedido|order)\s*#?\s*(\d{1,4})\b/i) ||
    raw.match(/#\s*(\d{1,4})\b/) ||
    raw.match(/^(?:el\s+|la\s+)?(?:n[uú]mero\s+)?(\d{1,3})[\s!.?]*$/i);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 9999) return null;
  return n;
}

/**
 * Solo pregunta de cobertura: “¿tienen domicilios para Cra 81A…?”
 * (sin estar pidiendo platos).
 * NO: “¿tienen servicio a domicilio?” (FAQ general, sin zona).
 */
export function isDeliveryAvailabilityFaq(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 6 || raw.length > 80) return false;
  if (/\b(para|en|hasta|por)\s+(?!domicilio\b)\S/i.test(raw) && /\d|#|calle|carrera|castilla|torre|apto/i.test(raw)) {
    return false;
  }
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    /\b(tienen|tiene|tienes|hacen|hace|hay)\s+(servicio\s+a\s+)?domicilios?\b/.test(t) ||
    /\btienes\s+domicilio\b/.test(t) ||
    /^domicilios?\s*[?¿]*$/.test(t)
  );
}

/** Tras idle de asesor: “???” / “no me han escrito”. */
export function isUnansweredHumanComplaint(text: string): boolean {
  const raw = (text || '').trim();
  if (!raw || raw.length > 120) return false;
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/^\?{1,6}[!¿?]*$/.test(raw.trim())) return true;
  return (
    /\bno\s+me\s+(han|has)\s+(escrito|contestado|respondido)\b/.test(t) ||
    /\bnadie\s+(me\s+)?(responde|contesta|escribe)\b/.test(t) ||
    /\by\s+el\s+asesor\b/.test(t) ||
    /\bsiguen\s+sin\s+(responder|contestar)\b/.test(t)
  );
}

export function isDeliveryCoverageInquiry(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.length < 12) return false;

  const orderingFood =
    /\b(quiero|dame|ponme|regala|pedi|pido|agrega|ordenar|un\s+pollo|una\s+sopa|combo\s+de|ejecutivo|arroz\s+con)\b/i.test(
      raw,
    );
  if (orderingFood) return false;

  // FAQ genérica: ¿hacen/tienen (servicio a) domicilio? — sin barrio/calle
  if (
    /\b(tienen|tiene|hacen|hace|hay)\s+(servicio\s+a\s+)?domicilios?\s*[?.!]*$/i.test(raw) ||
    /\b(servicio\s+a\s+domicilio|domicilio\s+a\s+domicilio)\s*[?.!]*$/i.test(raw) ||
    /\bustedes\s+tienen\s+(servicio\s+a\s+)?domicilio\b/i.test(raw)
  ) {
    // Si además hay zona explícita (“… domicilio para Castilla”), sí es cobertura
    if (!/\b(para|en|hasta|por)\s+(?!domicilio\b)(\S)/i.test(raw)) {
      return false;
    }
  }

  if (/\b(domicilios?|entregas?)\s+(para|a|en|hasta)\b/i.test(raw)) {
    // "domicilios a domicilio" no cuenta
    if (/\bdomicilios?\s+a\s+domicilio\b/i.test(raw)) return false;
    return true;
  }

  if (
    /\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
    /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
    /\b(para|en|hasta|por)\s+(?!domicilio\b)/i.test(raw)
  ) {
    return true;
  }

  // "a" solo si no es el "a" de "servicio a domicilio" / "a domicilio"
  if (
    /\b(tienen|hacen|hay|cubren|cubre|llegan|llega)\b/i.test(raw) &&
    /\b(domicilios?|entregas?|env[ií]os?)\b/i.test(raw) &&
    /\b(?:para|en|hasta|por)\s+(?!domicilio\b)\S/i.test(raw)
  ) {
    return true;
  }

  if (
    /\b(hacen|tienen)\s+(servicio\s+a\s+)?domicilio\b/i.test(raw) &&
    /\b(para|en|hasta)\s+(?!domicilio\b)\S/i.test(raw)
  ) {
    return true;
  }

  return false;
}

const CART_SWAP_SIDE_ONLY =
  /^(?:m[aá]s\s+)?(?:arepas?|papas?(?:\s+salada)?|yuca(?:\s+frita)?|ensalada|aguacate|maduro|patacones?|cebolla|tomate)$/i;

const CART_SWAP_DISH_TOKEN =
  /\b(?:combo|pollo|broaster|frito|asado|sopa|bandeja|costillas?|mojarras?|arroz|hamburguesa|pechuga|alitas?|churrascos?|ejecutivo|gaseosa|limonada|platano|pl[aá]tano|ajiaco|mondongo|sobrebarriga|tacos?|bagre|trucha)\b/i;

/**
 * "no quiero combo de broaster, quiero combo de frito" → quitar + agregar,
 * no nota de cocina.
 */
export function parseCartItemReplacement(
  text: string,
): { removeQuery: string; addQuery: string } | null {
  const raw = (text || '').trim();
  if (!raw || raw.length < 12) return null;

  const patterns = [
    /^no\s+quiero\s+(.+?)(?:\s*[,;]\s*|\s+)(?:quiero|dame|pon(?:me)?|mejor(?:\s+quiero)?)\s+(.+)$/i,
    /^(?:cambia(?:r|me)?|c[aá]mbial[oa]|reemplaza(?:r|me)?)\s+(.+?)\s+por\s+(.+)$/i,
    /^(?:en\s+vez\s+de)\s+(.+?)(?:\s*[,;]\s*|\s+)(?:quiero|dame|pon(?:me)?)?\s*(.+)$/i,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (!m?.[1]?.trim() || !m?.[2]?.trim()) continue;
    const removeQuery = m[1]
      .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const addQuery = m[2]
      .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (removeQuery.length < 3 || addQuery.length < 3) continue;
    if (CART_SWAP_SIDE_ONLY.test(removeQuery) || CART_SWAP_SIDE_ONLY.test(addQuery)) {
      continue;
    }
    if (!CART_SWAP_DISH_TOKEN.test(addQuery)) continue;
    return { removeQuery, addQuery };
  }
  return null;
}

export function isCartItemReplacementIntent(text: string): boolean {
  return !!parseCartItemReplacement(text);
}

/**
 * Tras “¿Te lo agrego?”: el cliente rechaza (a veces nombrando lo que ya tiene).
 * "No, solo el combo porfa" no debe reabrir atributos del combo.
 */
export function isPendingAddOfferDecline(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (
    /^(no|nop|nope|nel|despues|después|luego|ahora\s+no|no\s+gracias|mejor\s+no|nah)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^(no\s+se[nñ]or[a]?|no\s+gracias)([\s,!.?]+gracias)?[\s!.?]*$/i.test(t) &&
    !/\bdirecci/i.test(t)
  ) {
    return true;
  }
  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    /\bno\b/.test(n) &&
    /\bsolo\b/.test(n) &&
    !/\b(quiero|dame|agrega|ponme|pedi)\s+(un|una|unos|unas|otro|otra)\b/.test(n)
  ) {
    return true;
  }
  if (
    /^(solo|solamente|unicamente)\b.{0,60}\b(combo|carrito|pedido|eso|ese|esa|lo\s+que\s+(ya\s+)?(hay|tengo|pedi))\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bno\s+(lo\s+|la\s+|el\s+)?(agregues|agregar|metas|añadas|sumes)\b/i.test(t)) {
    return true;
  }
  if (/^no\b[,!.\s]+gracias\b/i.test(t) && t.length < 48 && !/\bdirecci/i.test(t)) {
    return true;
  }
  return false;
}

/** Extrae la dirección de una pregunta de cobertura. */
export function extractCoverageAddressProbe(text: string): string | null {
  const raw = (text || '').trim();
  if (!raw) return null;

  const patterns = [
    /\b(?:domicilios?|entregas?|env[ií]os?)\s+(?:para|a|en|hasta)\s+(?!domicilio\b)(.+?)[\s?!.]*$/i,
    /\bservicio\s+a\s+domicilio\s+(?:para|en|hasta)\s+(.+?)[\s?!.]*$/i,
    /\b(?:para|a|en|hasta)\s+((?:calle|carrera|cra|cll|dg|diagonal|av\.?|avenida|conjunto|torre|barrio)\b.+?)[\s?!.]*$/i,
    /\b(?:para|en|hasta)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9].{5,90})[\s?!.]*$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]) {
      const addr = m[1]
        .replace(/\b(por\s+favor|porfa|gracias|ok|vale)\b/gi, '')
        .replace(/[?!.]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (addr.length < 6) continue;
      // Nunca geocodificar la palabra "domicilio" como zona
      if (/^(domicilios?|entregas?|env[ií]os?|servicio)$/i.test(addr)) continue;
      return addr;
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
 * Tras “Responde con el *número*”, 1..N es SIEMPRE fila.
 * Códigos de menú (99, 15…) solo si están fuera del rango de filas o no hay fila.
 */
export function resolvePendingListOrMenuCode(opts: {
  bareNum: number | null;
  candidates: Array<{ id: number; code: number }>;
}): 'list_index' | 'menu_code' | null {
  const { bareNum, candidates } = opts;
  if (bareNum == null || !candidates.length) return null;
  const codeHit = candidates.find((c) => Number(c.code) === bareNum);
  // "1" con Combo en fila 1 y *#1* en otra fila → fila 1 (Combo), NO código #1
  if (bareNum >= 1 && bareNum <= candidates.length) {
    return 'list_index';
  }
  if (codeHit || bareNum > candidates.length) return 'menu_code';
  return null;
}
