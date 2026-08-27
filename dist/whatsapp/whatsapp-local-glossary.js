"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLocalGlossary = applyLocalGlossary;
exports.buildLocalGlossaryPromptBlock = buildLocalGlossaryPromptBlock;
const PHRASE_REWRITES = [
    { re: /\b(ajiaco|menudencias?)\s+(chico|chica|chiquito|chiquita|pequenito|pequenita)\b/gi, to: '$1 pequeña' },
    { re: /\bsopas?\s+(chicas?|chiquitas?|pequenitas?)\b/gi, to: 'sopa pequeña' },
    { re: /\bsopa\s+de\s+ajiaco\s+(chica|chiquita|pequenita)\b/gi, to: 'sopa de ajiaco pequeña' },
    { re: /\bsopa\s+ajiaco\s+(pequena|pequeña|chica)\b/gi, to: 'sopa de ajiaco pequeña' },
    { re: /\bmedio\s+de\s+pollo\b/gi, to: 'medio pollo' },
    { re: /\bun\s+medio\s+(?:de\s+)?pollo\b/gi, to: 'medio pollo' },
    { re: /\bpollo\s+a\s+la\s+broaster\b/gi, to: 'pollo broaster' },
    { re: /\bpollo\s+ala\s+broaster\b/gi, to: 'pollo broaster' },
    { re: /\bno\s+me\s+(?:pongan?|pongas)\s+/gi, to: 'no quiero ' },
    { re: /\bsin\s+arepitas?\b/gi, to: 'sin arepa' },
    { re: /\bmas\s+papitas?\b/gi, to: 'más papas' },
    { re: /\bmás\s+papitas?\b/gi, to: 'más papas' },
];
const WORD_REWRITES = [
    { re: /\bquieor\b/gi, to: 'quiero' },
    { re: /\bquiiero\b/gi, to: 'quiero' },
    { re: /\bqiero\b/gi, to: 'quiero' },
    { re: /\bkiero\b/gi, to: 'quiero' },
    { re: /\bquero\b/gi, to: 'quiero' },
    { re: /\bped[ií]\b/gi, to: 'pedi' },
    { re: /\bejeuctivo\b/gi, to: 'ejecutivo' },
    { re: /\bejecutvo\b/gi, to: 'ejecutivo' },
    { re: /\b(?:roaster|broster|brouster)\b/gi, to: 'broaster' },
    {
        re: /\bchurr+ascos?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'churrascos' : 'churrasco'),
    },
    {
        re: /\bmojarr+as?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'mojarras' : 'mojarra'),
    },
    {
        re: /\blimonad+as?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'limonadas' : 'limonada'),
    },
    {
        re: /\bhamburegsas?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
    },
    {
        re: /\bhamburgesas?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
    },
    {
        re: /\bhamburgues+as?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
    },
    {
        re: /\bhamburguersas?\b/gi,
        to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
    },
    { re: /\bajico\b/gi, to: 'ajiaco' },
    { re: /\bajiacos\b/gi, to: 'ajiaco' },
    { re: /\bmondongos\b/gi, to: 'mondongo' },
    { re: /\blitrso\b/gi, to: 'litros' },
    { re: /\b(?:un\s+)?litro\s+y\s+medi[oa]\b/gi, to: '1.5 litros' },
    { re: /\bmedia?\s+de\s+litro\b/gi, to: '0.5 litros' },
    { re: /\bpar\s+ale\b/gi, to: 'para el' },
    { re: /\bpar\s+a\s+la\b/gi, to: 'para la' },
    { re: /\bpar\s+a\s+el\b/gi, to: 'para el' },
    { re: /\bpar\s+el\b/gi, to: 'para el' },
    { re: /\bpar\s+la\b/gi, to: 'para la' },
    { re: /\bpala\s+el\b/gi, to: 'para el' },
    { re: /\bpala\s+la\b/gi, to: 'para la' },
    { re: /\bpala\s+los\b/gi, to: 'para los' },
    { re: /\bpala\s+las\b/gi, to: 'para las' },
];
function applyLocalGlossary(text) {
    let out = (text || '').trim();
    if (!out)
        return out;
    for (const { re, to } of PHRASE_REWRITES) {
        out = out.replace(re, to);
    }
    for (const { re, to } of WORD_REWRITES) {
        out = typeof to === 'function' ? out.replace(re, to) : out.replace(re, to);
    }
    return out.replace(/\s+/g, ' ').trim();
}
function buildLocalGlossaryPromptBlock() {
    return `
GLOSARIO DEL LOCAL (interpreta así; no inventes otros significados):
- "Sopa pequeña" / "ajiaco pequeño/chico" = SKU "Sopa pequeña" + atributo Ajiaco (NO "Sopa De Ajiaco", que es la grande).
- "Mondongo pequeña" = SKU "Sopa De Mondongo Pequeña".
- "Sopa De Ajiaco" / "ajiaco" sin "pequeña" = la grande.
- "Duo / doble / pack de X" solo si el cliente dice duo/doble/pack; si dice "una hamburguesa" → Hamburguesa unitaria.
- Preferencias "no quiero arepas, más papas, sin yuca" con carrito lleno = NOTA del plato, no productos nuevos.
- Typos frecuentes: churrrasco→churrasco, hamburegsa→hamburguesa, ajico→ajiaco, par ale→para el.
`.trim();
}
//# sourceMappingURL=whatsapp-local-glossary.js.map