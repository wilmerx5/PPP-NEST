"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogAccompanimentReply = catalogAccompanimentReply;
const normalize = (value) => value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
function catalogAccompanimentReply(text, products, catalog) {
    const q = normalize(text).replace(/\s+(?:porfa|por favor)$/, '');
    if (/\b(?:agrega|agregame|quiero|dame|ponme|quita|cambia|regalame|sin|alergia|alergico|gluten|lacteos)\b/.test(q))
        return null;
    const match = q.match(/^(.{3,100}?)\s+(?:trae[n]?|lleva[n]?|incluye[n]?|contiene[n]?|tiene[n]?|viene[n]?\s+con)\s+(?:con\s+)?(?:(?:el|la|los|las)\s+)?(ensalada|yuca|arroz|papa(?:s)?|arepa(?:s)?|sopa|bebida|gaseosa)$/);
    if (!match || /\b(?:y|o)\b/.test(match[1]))
        return null;
    const product = catalog.findProductEmbeddedInMessage(match[1], products.filter(p => p.availableNow !== false));
    if (!product)
        return null;
    const description = (product.description || '').trim().slice(0, 280);
    const side = match[2];
    if (!description)
        return `La carta no confirma si ${product.name} trae ${side}. Lo verificamos con el restaurante.`;
    const normalizedDescription = normalize(description);
    const stem = side.replace(/s$/, '');
    const token = `${stem}s?`;
    const present = new RegExp(`\\b${token}\\b`).test(normalizedDescription);
    const excluded = new RegExp(`\\b(?:sin|no (?:incluye[n]?|trae[n]?|lleva[n]?|tiene[n]?))\\s+(?:(?:el|la|los|las)\\s+)?${token}\\b`).test(normalizedDescription);
    const options = product.attributes?.some(a => a.options?.some(value => new RegExp(`\\b${token}\\b`).test(normalize(value))));
    if (options && !present)
        return `${side} aparece como una opción de ${product.name}; depende de la elección. ${description}.`;
    const prefix = present && !excluded
        ? `Sí, la carta de ${product.name} incluye ${side}.`
        : `La carta de ${product.name} no incluye ${side} entre sus acompañamientos registrados.`;
    return `${prefix} ${description}.`;
}
//# sourceMappingURL=whatsapp-product-composition.js.map