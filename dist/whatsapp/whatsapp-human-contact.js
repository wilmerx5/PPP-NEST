"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHATSAPP_AI_DISCLAIMER_SAFE = exports.WHATSAPP_HUMAN_CONTACT_MESSAGE = exports.WHATSAPP_HUMAN_CONTACT_PHONE = void 0;
exports.scrubAsesorHandoffCopy = scrubAsesorHandoffCopy;
exports.scrubAiDisclaimerCopy = scrubAiDisclaimerCopy;
exports.scrubOutboundAsesorMentions = scrubOutboundAsesorMentions;
exports.WHATSAPP_HUMAN_CONTACT_PHONE = '3118866823';
exports.WHATSAPP_HUMAN_CONTACT_MESSAGE = `No entendí bien tu mensaje 🙏 ¿Me lo aclaras?\n` +
    `Si prefieres, llámanos al *${exports.WHATSAPP_HUMAN_CONTACT_PHONE}*.`;
exports.WHATSAPP_AI_DISCLAIMER_SAFE = `Con gusto te atiendo. Aún estoy aprendiendo y a veces cometo errores. ` +
    `Si quieres, también puedes llamarnos al *${exports.WHATSAPP_HUMAN_CONTACT_PHONE}*.`;
function scrubAsesorHandoffCopy(text, fallback = exports.WHATSAPP_HUMAN_CONTACT_MESSAGE) {
    const t = (text || '').trim();
    if (!t)
        return fallback;
    if (/\basesor\b/i.test(t))
        return fallback;
    if (/te\s+paso\s+con\s+el\s+equipo|te\s+pasamos\s+con\s+el\s+equipo|atender\s+por\s+aqu[ií]|alguien\s+te\s+va\s+a\s+atender|escribe\s+\*?asesor\*?/i.test(t)) {
        return fallback;
    }
    return t;
}
function scrubAiDisclaimerCopy(text) {
    const t = (text || '').trim();
    if (!t)
        return exports.WHATSAPP_AI_DISCLAIMER_SAFE;
    if (/\basesor\b/i.test(t) ||
        /prefieres\s+(?:una\s+)?persona/i.test(t) ||
        /te\s+pasamos\s+con\s+el\s+equipo/i.test(t) ||
        /pasamos\s+con\s+el\s+equipo/i.test(t) ||
        /puede fallar/i.test(t) ||
        /en prueba/i.test(t)) {
        return exports.WHATSAPP_AI_DISCLAIMER_SAFE;
    }
    return t;
}
function scrubOutboundAsesorMentions(text) {
    const raw = (text || '').trim();
    if (!raw)
        return raw;
    if (/te\s+paso\s+con\s+el\s+equipo|alguien\s+te\s+va\s+a\s+atender\s+por\s+aqu[ií]/i.test(raw)) {
        return exports.WHATSAPP_HUMAN_CONTACT_MESSAGE;
    }
    if (!/\basesor\b/i.test(raw) && !/escribe\s+\*?asesor\*?/i.test(raw)) {
        return raw;
    }
    let t = raw
        .replace(/[^.!?\n]*\basesor\b[^.!?\n]*[.!?]?/gi, '')
        .replace(/[^.!?\n]*escribe\s+\*?asesor\*?[^.!?\n]*[.!?]?/gi, '')
        .replace(/[^.!?\n]*pase\s+con\s+un\s+[^.!?\n]*[.!?]?/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!t || t.length < 12)
        return exports.WHATSAPP_HUMAN_CONTACT_MESSAGE;
    return t;
}
//# sourceMappingURL=whatsapp-human-contact.js.map