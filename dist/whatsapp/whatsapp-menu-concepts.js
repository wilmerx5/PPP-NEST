"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MENU_CONCEPTS = void 0;
exports.resolveMenuConceptGroups = resolveMenuConceptGroups;
exports.findByMenuConcept = findByMenuConcept;
exports.buildMenuConceptsPromptBlock = buildMenuConceptsPromptBlock;
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
        id: 'bebida',
        label: 'Bebidas',
        triggers: ['bebida', 'bebidas', 'gaseosa', 'jugo', 'limonada'],
        productKeywords: [
            'gaseosa',
            'coca',
            'sprite',
            'limonada',
            'jugo',
            'malta',
            'agua',
            'te',
            'té',
            'cerveza',
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
        if (!triggers.length || !productKeywords.length)
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
        if (q === t || q.includes(t) || (q.length >= 4 && t.includes(q)))
            return true;
        for (const token of q.split(' ').filter((x) => x.length >= 3)) {
            if (token === t || t.includes(token) || token.includes(t))
                return true;
        }
    }
    return false;
}
function productMatchesConcept(p, concept) {
    const hay = normalizeText(`${p.name} ${p.description || ''} ${p.categoryName || ''}`);
    for (const kw of concept.productKeywords) {
        if (kw.length >= 3 && hay.includes(kw))
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
        const matched = available.filter((p) => productMatchesConcept(p, concept));
        if (!matched.length)
            continue;
        let score = 70;
        if (concept.triggers.some((t) => q === normalizeText(t)))
            score = 100;
        else if (concept.triggers.some((t) => q.includes(normalizeText(t))))
            score = 85;
        if (!best || score > best.score || (score === best.score && matched.length > best.products.length)) {
            best = { concept, products: matched, score };
        }
    }
    if (!best)
        return null;
    return {
        categoryName: best.concept.label,
        products: best.products,
        conceptId: best.concept.id,
    };
}
function buildMenuConceptsPromptBlock(groups) {
    const concepts = resolveMenuConceptGroups(groups).filter((c) => c.enabled !== false);
    if (!concepts.length)
        return '';
    const lines = concepts.map((c) => `  • "${c.label}": si piden ${c.triggers.slice(0, 4).join(', ')}… busca productos como ${c.productKeywords.slice(0, 4).join(', ')}`);
    return (`CONCEPTOS DEL MENÚ (no siempre = nombre de categoría; usa esto para orientar):\n` +
        lines.join('\n'));
}
//# sourceMappingURL=whatsapp-menu-concepts.js.map