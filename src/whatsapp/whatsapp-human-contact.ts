/** Contacto humano temporal por teléfono (sin asesor por chat). */

export const WHATSAPP_HUMAN_CONTACT_PHONE = '3118866823';

/** Fallback suave: no entendió / meta / handoff sin asesorar por chat. */
export const WHATSAPP_HUMAN_CONTACT_MESSAGE =
  `No entendí bien tu mensaje 🙏 ¿Me lo aclaras?\n` +
  `Si prefieres, llámanos al *${WHATSAPP_HUMAN_CONTACT_PHONE}*.`;

export const WHATSAPP_AI_DISCLAIMER_SAFE =
  '⚠️ Chat con *IA* (en prueba; puede fallar). Si necesitas ayuda: contáctanos al *3118866823*.';

/**
 * Plantillas viejas en BD (“ASESOR”, “te paso con el equipo”) no deben
 * reactivar handoff por chat mientras el asesor esté deshabilitado.
 */
export function scrubAsesorHandoffCopy(
  text: string,
  fallback: string = WHATSAPP_HUMAN_CONTACT_MESSAGE,
): string {
  const t = (text || '').trim();
  if (!t) return fallback;
  if (/\basesor\b/i.test(t)) return fallback;
  if (
    /te\s+paso\s+con\s+el\s+equipo|te\s+pasamos\s+con\s+el\s+equipo|atender\s+por\s+aqu[ií]|alguien\s+te\s+va\s+a\s+atender|escribe\s+\*?asesor\*?/i.test(
      t,
    )
  ) {
    return fallback;
  }
  return t;
}

/** Disclaimer de bienvenida: nunca mencionar ASESOR ni handoff por chat. */
export function scrubAiDisclaimerCopy(text: string): string {
  const t = (text || '').trim();
  if (!t) return WHATSAPP_AI_DISCLAIMER_SAFE;
  if (
    /\basesor\b/i.test(t) ||
    /prefieres\s+(?:una\s+)?persona/i.test(t) ||
    /te\s+pasamos\s+con\s+el\s+equipo/i.test(t) ||
    /pasamos\s+con\s+el\s+equipo/i.test(t)
  ) {
    return WHATSAPP_AI_DISCLAIMER_SAFE;
  }
  return t;
}

/**
 * Cualquier reply saliente: no ofrecer ASESOR ni “te paso con el equipo”.
 * Si el texto es solo handoff, deja el teléfono; si es mixto, limpia frases de asesor.
 */
export function scrubOutboundAsesorMentions(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return raw;
  if (
    /te\s+paso\s+con\s+el\s+equipo|alguien\s+te\s+va\s+a\s+atender\s+por\s+aqu[ií]/i.test(
      raw,
    )
  ) {
    return WHATSAPP_HUMAN_CONTACT_MESSAGE;
  }
  if (!/\basesor\b/i.test(raw) && !/escribe\s+\*?asesor\*?/i.test(raw)) {
    return raw;
  }
  let t = raw
    .replace(/[^.!?\n]*\basesor\b[^.!?\n]*[.!?]?/gi, ' ')
    .replace(/[^.!?\n]*escribe\s+\*?asesor\*?[^.!?\n]*[.!?]?/gi, ' ')
    .replace(/[^.!?\n]*pase\s+con\s+un\s+[^.!?\n]*[.!?]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length < 12) return WHATSAPP_HUMAN_CONTACT_MESSAGE;
  if (!t.includes(WHATSAPP_HUMAN_CONTACT_PHONE)) {
    t = `${t}\n\n${WHATSAPP_HUMAN_CONTACT_MESSAGE}`;
  }
  return t;
}
