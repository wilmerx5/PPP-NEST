"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHATSAPP_AI_DISCLAIMER_SAFE = exports.WHATSAPP_HUMAN_CONTACT_MESSAGE = exports.WHATSAPP_HUMAN_CONTACT_PHONE = void 0;
exports.scrubAsesorHandoffCopy = scrubAsesorHandoffCopy;
exports.scrubAiDisclaimerCopy = scrubAiDisclaimerCopy;
exports.WHATSAPP_HUMAN_CONTACT_PHONE = '3118866823';
exports.WHATSAPP_HUMAN_CONTACT_MESSAGE = `Por favor contáctanos al *${exports.WHATSAPP_HUMAN_CONTACT_PHONE}*.`;
exports.WHATSAPP_AI_DISCLAIMER_SAFE = '⚠️ Chat con *IA* (en prueba; puede fallar). Si necesitas ayuda: contáctanos al *3118866823*.';
function scrubAsesorHandoffCopy(text, fallback = exports.WHATSAPP_HUMAN_CONTACT_MESSAGE) {
    const t = (text || '').trim();
    if (!t)
        return fallback;
    if (/\basesor\b/i.test(t))
        return fallback;
    if (/te\s+paso\s+con\s+el\s+equipo|atender\s+por\s+aqu[ií]|alguien\s+te\s+va\s+a\s+atender|escribe\s+\*?asesor\*?/i.test(t)) {
        return fallback;
    }
    return t;
}
function scrubAiDisclaimerCopy(text) {
    const t = (text || '').trim();
    if (!t)
        return exports.WHATSAPP_AI_DISCLAIMER_SAFE;
    if (/\basesor\b/i.test(t) || /prefieres\s+persona/i.test(t)) {
        return exports.WHATSAPP_AI_DISCLAIMER_SAFE;
    }
    return t;
}
//# sourceMappingURL=whatsapp-human-contact.js.map