"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MENU_CONCEPTS = void 0;
exports.resolveMenuConceptGroups = resolveMenuConceptGroups;
exports.findByMenuConcept = findByMenuConcept;
exports.buildMenuConceptsPromptBlock = buildMenuConceptsPromptBlock;
exports.resolveConceptBrowseForAgent = resolveConceptBrowseForAgent;
const whatsapp_named_menu_dish_1 = require("./whatsapp-named-menu-dish");
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function hasWholeWordOrStem(haystack, needle) {
    const h = normalizeText(haystack);
    const n = normalizeText(needle);
    if (!h || !n || n.length < 2)
        return false;
    if (h === n)
        return true;
    const nStem = stemLoose(n);
    if (n.length <= 4) {
        const re = new RegExp(`(?:^|\\s)${escapeRegExp(n)}(?:\\s|$)`);
        const reStem = nStem !== n && nStem.length >= 3
            ? new RegExp(`(?:^|\\s)${escapeRegExp(nStem)}(?:\\s|$)`)
            : null;
        return re.test(h) || (!!reStem && reStem.test(h));
    }
    if (new RegExp(`(?:^|\\s)${escapeRegExp(n)}(?:\\s|$)`).test(h))
        return true;
    if (nStem.length >= 5 &&
        new RegExp(`(?:^|\\s)${escapeRegExp(nStem)}(?:\\s|$)`).test(h)) {
        return true;
    }
    if (n.length >= 6 && h.includes(n))
        return true;
    return false;
}
function tokenMatchesTrigger(token, trigger) {
    const t = normalizeText(token);
    const tr = normalizeText(trigger);
    if (!t || !tr)
        return false;
    if (t === tr)
        return true;
    const ts = stemLoose(t);
    const trs = stemLoose(tr);
    if (ts === trs)
        return true;
    if (tr.length <= 4 || t.length <= 4)
        return false;
    const ratio = Math.min(t.length, tr.length) / Math.max(t.length, tr.length);
    if (ratio < 0.75)
        return false;
    return t.includes(tr) || tr.includes(t) || ts.includes(trs) || trs.includes(ts);
}
exports.DEFAULT_MENU_CONCEPTS = [
    {
        id: 'carne',
        label: 'Carne',
        triggers: ['carne', 'carnes', 'res', 'cerdo', 'bistec', 'lomo', 'asado', 'vacuno'],
        productKeywords: [
            'churrasco',
            'sobrebarriga',
            'sobre barriga',
            'bistec',
            'lomo',
            'punta',
            'posta',
            'carne',
            'res',
            'pechuga de res',
            'higado',
            'hígado',
        ],
    },
    {
        id: 'pollo',
        label: 'Pollo',
        triggers: ['pollo', 'pollos', 'broaster', 'asado'],
        productKeywords: ['pollo', 'broaster', 'pechuga', 'ala', 'alas', 'entero', 'medio', 'cuarto'],
    },
    {
        id: 'sopa',
        label: 'Sopas',
        triggers: ['sopa', 'sopas', 'caldo', 'caldos'],
        productKeywords: ['sopa', 'caldo', 'consome', 'consomé', 'cazuela'],
    },
    {
        id: 'arroz',
        label: 'Arroz',
        triggers: ['arroz', 'chino', 'paisa'],
        productKeywords: ['arroz', 'chino', 'paisa', 'cantones'],
    },
    {
        id: 'pescado',
        label: 'Pescado',
        triggers: ['pescado', 'pescados', 'marisco', 'mariscos', 'mojarra', 'trucha', 'bagre'],
        productKeywords: ['mojarra', 'trucha', 'bagre', 'pescado', 'filete', 'tilapia'],
    },
    {
        id: 'mexicana',
        label: 'Comida mexicana',
        triggers: ['mexicana', 'mexicano', 'mexicanos', 'mexicanas', 'taco', 'tacos'],
        productKeywords: ['taco', 'tacos', 'burrito', 'quesadilla', 'nacho', 'mexicana', 'mexicano'],
    },
    {
        id: 'comida_rapida',
        label: 'Comida rápida',
        triggers: [
            'comida rapida',
            'comidas rapidas',
            'hamburguesa',
            'hamburguesas',
            'salchipapa',
            'salchipapas',
            'perro caliente',
            'perros calientes',
        ],
        productKeywords: [
            'hamburguesa',
            'salchipapa',
            'perro',
            'hot dog',
            'nugget',
            'nuggets',
        ],
    },
    {
        id: 'bebida',
        label: 'Bebidas',
        triggers: [
            'bebida',
            'bebidas',
            'gaseosa',
            'gaseosas',
            'refresco',
            'refrescos',
            'jugo',
            'jugos',
            'limonada',
            'limonadas',
            'malta',
            'agua',
            'cerveza',
        ],
        productKeywords: [
            'gaseosa',
            'coca',
            'sprite',
            'pepsi',
            'postobon',
            'limonada',
            'jugo',
            'malta',
            'agua',
            'te',
            'té',
            'cerveza',
            'hit',
            'mr tea',
            'cysco',
        ],
    },
];
function normalizeText(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function stemLoose(s) {
    const n = normalizeText(s);
    if (/(antes|entes|iones|unes|artes|ueves|iernes|abados|omingos)$/.test(n)) {
        if (n.length > 3 && n.endsWith('s') && !n.endsWith('es'))
            return n.slice(0, -1);
        if (n.length > 4 && n.endsWith('es') && /(antes|entes|iones)$/.test(n)) {
            return n.slice(0, -1);
        }
        return n;
    }
    if (n.length > 3 && n.endsWith('s') && !n.endsWith('es'))
        return n.slice(0, -1);
    if (n.length > 4 && n.endsWith('es')) {
        const minusS = n.slice(0, -1);
        if (/(ne|re|le|de|se|te|pe)$/.test(minusS))
            return minusS;
        return n.slice(0, -2);
    }
    return n;
}
function titleCaseWords(s) {
    return s
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
const BROAD_CONCEPT_TRIGGERS = {
    bebida: ['bebida', 'bebidas'],
    pollo: ['pollo', 'pollos'],
    sopa: ['sopa', 'sopas', 'caldo', 'caldos'],
    carne: ['carne', 'carnes'],
    arroz: ['arroz'],
    comida_rapida: [
        'comida rapida',
        'comidas rapidas',
        'comida rápida',
        'rapida',
        'rápida',
    ],
    mexicana: ['mexicana', 'mexicano', 'mexicanos', 'mexicanas', 'taco', 'tacos'],
};
function isBroadConceptTrigger(concept, trigger) {
    const t = stemLoose(trigger);
    const label = stemLoose(concept.label);
    if (t === label)
        return true;
    const broad = BROAD_CONCEPT_TRIGGERS[concept.id] || [label];
    return broad.some((b) => stemLoose(b) === t);
}
function getMatchedConceptTriggers(q, concept) {
    const matched = [];
    for (const trigger of concept.triggers) {
        const t = normalizeText(trigger);
        if (!t || t.length < 3)
            continue;
        if (q === t || hasWholeWordOrStem(q, t)) {
            matched.push(t);
            continue;
        }
        for (const token of q.split(' ').filter((x) => x.length >= 3)) {
            if (tokenMatchesTrigger(token, t)) {
                matched.push(t);
            }
        }
    }
    return [...new Set(matched)];
}
function filterProductsByConceptTriggers(products, triggers) {
    const needles = [...new Set(triggers.map((t) => normalizeText(t)).filter((t) => t.length >= 3))];
    if (!needles.length)
        return products;
    return products.filter((p) => {
        const hay = normalizeText(`${p.name} ${p.description || ''}`);
        return needles.some((n) => hasWholeWordOrStem(hay, n));
    });
}
function buildConceptListLabel(concept, narrowTriggers) {
    if (!narrowTriggers.length)
        return concept.label;
    if (narrowTriggers.length === 1)
        return titleCaseWords(narrowTriggers[0]);
    return titleCaseWords(narrowTriggers.slice(0, 3).join(' / '));
}
function resolveMenuConceptGroups(stored) {
    if (!Array.isArray(stored) || !stored.length) {
        return exports.DEFAULT_MENU_CONCEPTS.map((c) => ({ ...c, triggers: [...c.triggers], productKeywords: [...c.productKeywords] }));
    }
    const out = [];
    for (const raw of stored) {
        if (!raw || typeof raw !== 'object')
            continue;
        const row = raw;
        const id = normalizeText(String(row.id || row.label || '')).replace(/\s+/g, '_') || `concept_${out.length + 1}`;
        const label = String(row.label || id).trim().slice(0, 80) || id;
        const triggers = (Array.isArray(row.triggers)
            ? row.triggers
            : String(row.triggers || '')
                .split(',')
                .map((t) => t.trim()))
            .map((t) => normalizeText(String(t)))
            .filter(Boolean);
        const productKeywords = (Array.isArray(row.productKeywords)
            ? row.productKeywords
            : String(row.productKeywords || row.productMatch || '')
                .split(',')
                .map((t) => t.trim()))
            .map((t) => normalizeText(String(t)))
            .filter(Boolean);
        if (!triggers.length)
            continue;
        out.push({
            id,
            label,
            triggers: [...new Set(triggers)],
            productKeywords: [...new Set(productKeywords)],
            enabled: row.enabled !== false,
        });
    }
    return out.length ? out : resolveMenuConceptGroups(null);
}
function queryMatchesConcept(q, concept) {
    for (const trigger of concept.triggers) {
        const t = normalizeText(trigger);
        if (!t || t.length < 3)
            continue;
        if (q === t || hasWholeWordOrStem(q, t))
            return true;
        for (const token of q.split(' ').filter((x) => x.length >= 3)) {
            if (tokenMatchesTrigger(token, t))
                return true;
        }
    }
    return false;
}
const CATEGORY_ALIASES = {
    carne: ['carne', 'carnes', 'res', 'cerdo', 'parrilla', 'asados', 'asado', 'grill', 'cortes'],
    pollo: ['pollo', 'pollos', 'aves', 'broaster'],
    sopa: ['sopa', 'sopas', 'caldo', 'caldos', 'sopitas'],
    arroz: ['arroz', 'arroces', 'chinos'],
    pescado: ['pescado', 'pescados', 'mariscos', 'pescaderia'],
    comida_rapida: [
        'comida rapida',
        'comidas rapidas',
        'comida rápida',
        'hamburguesa',
        'hamburguesas',
        'salchipapa',
        'salchipapas',
    ],
    mexicana: ['taco', 'tacos', 'mexicana', 'mexicano', 'mexicanos', 'burritos'],
    bebida: ['bebida', 'bebidas', 'gaseosa', 'gaseosas', 'jugo', 'jugos', 'refresco', 'refrescos'],
};
const GENERIC_CATEGORY_RE = /\b(carta|especial(?:es)?|platos?(?:\s+fuertes?)?|fuertes?|menu|almuerzo|comida|recomend\w*|del\s*dia|principales?|ejecutivos?)\b/i;
const SIDE_OR_DRINK_CATEGORY_RE = /\b(bebida|bebidas|gaseosa|jugos?|limonada|extra|adiciones?|guarnici\w*|acompan\w*|arepas?\s+suelt)/i;
const SEMANTIC_FILTER_HINTS = {
    carne: 'Filtra SEMÁNTICAMENTE entre candidates: solo carne de res/cerdo/ternera ' +
        '(churrasco, sobrebarriga, solomillo, punta de anca, bistec, lomo, posta, costilla de res…). ' +
        'EXCLUYE pollo, pescado/mojarra/trucha/bagre, sopas, arroz, bebidas y acompañamientos. ' +
        'Ofrece 2–4 en tono natural. NUNCA digas "no encontré". Si ninguno encaja, dilo breve y ofrece menú.',
    pollo: 'Filtra SEMÁNTICAMENTE: solo platos de pollo (frito, broaster, pechuga, alitas, combos de pollo). ' +
        'EXCLUYE carne de res, pescado, sopas sueltas y bebidas. Ofrece 2–4 natural. NO digas "no encontré".',
    sopa: 'Filtra SEMÁNTICAMENTE: solo sopas/caldos (ajiaco, mondongo, menudencias, sancocho…). ' +
        'EXCLUYE platos secos, carnes a la plancha, pollo entero y bebidas. Ofrece 2–4 natural.',
    arroz: 'Filtra SEMÁNTICAMENTE: arroces (chino, paisa, etc.). EXCLUYE pollo suelto, carnes y bebidas.',
    pescado: 'Filtra SEMÁNTICAMENTE: pescados/mariscos (mojarra, trucha, bagre…). EXCLUYE carne de res, pollo y bebidas.',
    comida_rapida: 'Filtra SEMÁNTICAMENTE: comida rápida (hamburguesa, salchipapa, perro caliente, nuggets). ' +
        'EXCLUYE pollo entero/combo, arroz chino, sopas y bebidas sueltas. Lista los platos de esa categoría, no un resumen.',
    mexicana: 'Filtra SEMÁNTICAMENTE: comida mexicana (tacos, burritos, quesadillas). ' +
        'EXCLUYE hamburguesas, alitas, pollo, arroz y bebidas. Lista esos platos; si no hay, dilo breve.',
    bebida: 'Filtra SEMÁNTICAMENTE: solo bebidas (gaseosa, jugo, limonada…). EXCLUYE comida.',
};
function categoryMatchesConcept(categoryName, concept) {
    const cat = normalizeText(categoryName || '');
    if (!cat || cat.length < 3)
        return false;
    const catStem = stemLoose(cat);
    const needles = [
        concept.label,
        concept.id,
        ...concept.triggers,
        ...(CATEGORY_ALIASES[concept.id] || []),
    ];
    for (const raw of needles) {
        const n = normalizeText(raw);
        if (!n || n.length < 3)
            continue;
        if (cat === n || catStem === stemLoose(n))
            return true;
        if (hasWholeWordOrStem(cat, n))
            return true;
        if (cat.includes(n) || cat.includes(stemLoose(n)))
            return true;
    }
    return false;
}
function productMatchesConcept(p, concept) {
    if (categoryMatchesConcept(p.categoryName, concept))
        return true;
    const hay = normalizeText(`${p.name} ${p.description || ''}`);
    for (const kw of concept.productKeywords) {
        const k = normalizeText(kw);
        if (k.length >= 3 && hasWholeWordOrStem(hay, k))
            return true;
    }
    return false;
}
function findByMenuConcept(query, products, groups) {
    const q = normalizeText(query);
    if (!q || q.length < 3)
        return null;
    const concepts = resolveMenuConceptGroups(groups);
    let best = null;
    for (const concept of concepts) {
        if (concept.enabled === false)
            continue;
        if (!queryMatchesConcept(q, concept))
            continue;
        const available = products.filter((p) => p.availableNow !== false);
        let matched = available.filter((p) => productMatchesConcept(p, concept));
        if (!matched.length)
            continue;
        const matchedTriggers = getMatchedConceptTriggers(q, concept);
        const narrowTriggers = matchedTriggers.filter((t) => !isBroadConceptTrigger(concept, t));
        let askedButMissing;
        if (narrowTriggers.length) {
            const filtered = filterProductsByConceptTriggers(matched, narrowTriggers);
            if (filtered.length) {
                matched = filtered;
            }
            else {
                askedButMissing = [...narrowTriggers].sort((a, b) => b.length - a.length)[0];
            }
        }
        else {
            const stop = new Set([
                'con', 'de', 'del', 'la', 'el', 'los', 'las', 'una', 'un', 'unos', 'unas',
                'quiero', 'dame', 'ponme', 'para', 'por',
                'tiene', 'tienen', 'tienes', 'hay', 'ofrecen', 'ofreces', 'venden', 'vendes',
                'manejan', 'manejas', 'disponible', 'disponibles', 'hola', 'buenas', 'buenos',
                'favor', 'porfa', 'gracias',
                'comida', 'comidas', 'plato', 'platos', 'hola', 'vecino', 'vecina', 'veci',
            ]);
            const broadNeedles = new Set([...matchedTriggers, ...(BROAD_CONCEPT_TRIGGERS[concept.id] || []), concept.label]
                .map((t) => stemLoose(normalizeText(t)))
                .filter((t) => t.length >= 3));
            const broadPhrases = [
                ...matchedTriggers,
                ...(BROAD_CONCEPT_TRIGGERS[concept.id] || []),
                concept.label,
            ].map((t) => normalizeText(t));
            const extraTokens = q
                .split(' ')
                .map((t) => t.trim())
                .filter((t) => {
                if (t.length < 4 || stop.has(t) || broadNeedles.has(stemLoose(t)))
                    return false;
                if (broadPhrases.some((phrase) => phrase.split(' ').some((w) => w === t || stemLoose(w) === stemLoose(t)))) {
                    return false;
                }
                return true;
            });
            if (extraTokens.length) {
                const filtered = matched.filter((p) => {
                    const hay = normalizeText(`${p.name} ${p.description || ''}`);
                    return extraTokens.some((tok) => hay.includes(tok) || hay.includes(stemLoose(tok)));
                });
                if (filtered.length >= 1) {
                    matched = filtered;
                }
                else {
                    continue;
                }
            }
        }
        let score = 70;
        if (concept.triggers.some((t) => q === normalizeText(t)))
            score = 100;
        else if (concept.triggers.some((t) => hasWholeWordOrStem(q, normalizeText(t))))
            score = 85;
        if (narrowTriggers.length)
            score += 8;
        if (!best || score > best.score || (score === best.score && matched.length > best.products.length)) {
            best = { concept, products: matched, score, narrowTriggers, askedButMissing };
        }
    }
    if (!best)
        return null;
    return {
        categoryName: best.askedButMissing
            ? best.concept.label
            : buildConceptListLabel(best.concept, best.narrowTriggers),
        products: best.products,
        conceptId: best.concept.id,
        askedButMissing: best.askedButMissing
            ? titleCaseWords(best.askedButMissing)
            : undefined,
    };
}
function buildMenuConceptsPromptBlock(groups) {
    const concepts = resolveMenuConceptGroups(groups).filter((c) => c.enabled !== false);
    if (!concepts.length)
        return '';
    const lines = concepts.map((c) => {
        const catHint = (CATEGORY_ALIASES[c.id] || [c.label]).slice(0, 3).join('/');
        const kw = c.productKeywords.slice(0, 3).join(', ');
        return (`  • "${c.label}": si piden ${c.triggers.slice(0, 4).join(', ')}… ` +
            `lista productos de categorías tipo ${catHint}` +
            (kw ? ` (también nombres con ${kw}…)` : '') +
            `; si el menú mezcla todo en "carta/especiales", search_menu te da candidates y TÚ filtras por significado`);
    });
    return (`CONCEPTOS DEL MENÚ (categoría limpia O filtro semántico del agente):\n` +
        lines.join('\n'));
}
function isGenericMenuCategory(categoryName) {
    const cat = (categoryName || '').trim();
    if (!cat)
        return true;
    if (SIDE_OR_DRINK_CATEGORY_RE.test(cat))
        return false;
    if (/\brapid/i.test(cat))
        return false;
    return GENERIC_CATEGORY_RE.test(cat);
}
function keywordMatchesProduct(p, concept) {
    const hay = normalizeText(`${p.name} ${p.description || ''}`);
    for (const kw of concept.productKeywords) {
        const k = normalizeText(kw);
        if (k.length >= 3 && hasWholeWordOrStem(hay, k))
            return true;
    }
    return false;
}
function resolveConceptBrowseForAgent(query, products, groups) {
    const q = normalizeText(query);
    if (!q || q.length < 3)
        return null;
    if ((0, whatsapp_named_menu_dish_1.isNamedMenuDishOrderPhrase)(query)) {
        return null;
    }
    const concepts = resolveMenuConceptGroups(groups).filter((c) => c.enabled !== false);
    const concept = concepts.find((c) => queryMatchesConcept(q, c));
    if (!concept)
        return null;
    const available = products.filter((p) => p.availableNow !== false);
    const fromSpecificCategory = available.filter((p) => categoryMatchesConcept(p.categoryName, concept));
    const fromKeywords = available.filter((p) => keywordMatchesProduct(p, concept));
    const fromGenericCategories = available.filter((p) => isGenericMenuCategory(p.categoryName) &&
        !SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || ''));
    const fromDrinkCategories = available.filter((p) => SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || ''));
    const wantsJuiceOnly = /\b(jugos?|limonadas?|zumos?)\b/.test(q);
    const juiceLike = (p) => {
        const hay = normalizeText(`${p.name} ${p.description || ''} ${p.categoryName || ''}`);
        return /\b(jugo|jugos|limonada|limonadas|zumo|natural|hit|maracuya|lulo|mora|mango|naranja|fresa)\b/.test(hay);
    };
    if (concept.id === 'bebida' && wantsJuiceOnly) {
        const juices = available.filter(juiceLike);
        let pool = juices.length
            ? juices
            : [...fromSpecificCategory, ...fromKeywords, ...fromDrinkCategories];
        const juiceStop = new Set([
            'con', 'de', 'del', 'la', 'el', 'los', 'las', 'una', 'un', 'unos', 'unas', 'en', 'y',
            'no', 'si', 'que', 'qué', 'tambien', 'también',
            'quiero', 'dame', 'ponme', 'para', 'por',
            'tiene', 'tienen', 'tienes', 'hay', 'ofrecen', 'ofreces', 'venden', 'vendes',
            'manejan', 'manejas', 'disponible', 'disponibles', 'hola', 'buenas', 'buenos',
            'favor', 'porfa', 'gracias',
        ]);
        const juiceBroad = new Set([
            'jugo', 'jugos', 'limonada', 'limonadas', 'zumo', 'zumos',
            'bebida', 'bebidas', 'natural', 'naturales',
            concept.label,
            ...(BROAD_CONCEPT_TRIGGERS.bebida || []),
        ].map((t) => stemLoose(normalizeText(t))));
        const juiceExtra = q
            .split(' ')
            .map((t) => t.trim())
            .filter((t) => t.length >= 3 && !juiceStop.has(t) && !juiceBroad.has(stemLoose(t)));
        if (juiceExtra.length && pool.length) {
            const narrowed = pool.filter((p) => {
                const hay = normalizeText(`${p.name} ${p.description || ''}`);
                return juiceExtra.every((tok) => hay.includes(tok) || hay.includes(stemLoose(tok)));
            });
            if (narrowed.length >= 1) {
                pool = narrowed;
                const label = narrowed.length === 1
                    ? narrowed[0].name
                    : `Jugos (${juiceExtra.slice(0, 2).join(' ')})`;
                return {
                    mode: 'semantic_filter',
                    conceptId: concept.id,
                    conceptLabel: label,
                    products: [...new Map(pool.map((p) => [p.id, p])).values()].slice(0, 12),
                    hint: narrowed.length === 1
                        ? `El cliente pregunta por esa variante concreta (${juiceExtra.join(' ')}). ` +
                            `Confirma *${narrowed[0].name}* con precio de candidates. Si preguntan "¿tienen?", di que sí y ofrece agregarlo. ` +
                            `No listes otros jugos ni gaseosas a menos que pregunten.`
                        : `El cliente pide jugo con detalle (${juiceExtra.join(', ')}). ` +
                            `Ofrece solo candidates con precio. EXCLUYE gaseosas y comida.`,
                };
            }
            return null;
        }
        if (pool.length) {
            return {
                mode: 'semantic_filter',
                conceptId: concept.id,
                conceptLabel: 'Jugos',
                products: [...new Map(pool.map((p) => [p.id, p])).values()].slice(0, 20),
                hint: 'El cliente pidió *jugos* (o limonadas). Lista 2–4 jugos/limonadas de candidates con precio. ' +
                    'Incluye variantes en agua y en leche si están. EXCLUYE gaseosas, comida y combos. ' +
                    'NUNCA digas "no encontré". No ofrezcas pollo/pescado.',
            };
        }
    }
    const specificIsClean = fromSpecificCategory.length >= 1 &&
        fromSpecificCategory.every((p) => !isGenericMenuCategory(p.categoryName));
    if (specificIsClean && fromSpecificCategory.length >= 1) {
        const merged = new Map();
        for (const p of [...fromSpecificCategory, ...fromKeywords])
            merged.set(p.id, p);
        return {
            mode: concept.id === 'bebida' ? 'semantic_filter' : 'category_clean',
            conceptId: concept.id,
            conceptLabel: concept.label,
            products: [...merged.values()].slice(0, 12),
            hint: concept.id === 'bebida'
                ? SEMANTIC_FILTER_HINTS.bebida
                : `Categoría clara "${concept.label}". Ofrece 2–4 opciones en tono natural. ` +
                    `NUNCA digas "no encontré".`,
        };
    }
    const pool = new Map();
    if (concept.id === 'bebida') {
        for (const p of [...fromSpecificCategory, ...fromKeywords, ...fromDrinkCategories]) {
            pool.set(p.id, p);
        }
        if (pool.size < 3) {
            for (const p of available) {
                if (!SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || '') && !keywordMatchesProduct(p, concept)) {
                    continue;
                }
                pool.set(p.id, p);
                if (pool.size >= 28)
                    break;
            }
        }
    }
    else {
        for (const p of [...fromSpecificCategory, ...fromKeywords, ...fromGenericCategories]) {
            pool.set(p.id, p);
        }
        if (pool.size < 3) {
            for (const p of available) {
                if (SIDE_OR_DRINK_CATEGORY_RE.test(p.categoryName || ''))
                    continue;
                pool.set(p.id, p);
                if (pool.size >= 28)
                    break;
            }
        }
    }
    if (!pool.size)
        return null;
    const hint = SEMANTIC_FILTER_HINTS[concept.id] ||
        `Filtra SEMÁNTICAMENTE candidates que encajen con "${concept.label}". ` +
            `Ofrece 2–4 natural. NUNCA digas "no encontré".`;
    return {
        mode: 'semantic_filter',
        conceptId: concept.id,
        conceptLabel: concept.label,
        products: [...pool.values()].slice(0, 35),
        hint,
    };
}
//# sourceMappingURL=whatsapp-menu-concepts.js.map