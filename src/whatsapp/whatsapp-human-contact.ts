/** Contacto humano temporal por teléfono (sin asesor por chat). */

export const WHATSAPP_HUMAN_CONTACT_PHONE = '3118866823';

export const WHATSAPP_HUMAN_CONTACT_MESSAGE = `Por favor contáctanos al *${WHATSAPP_HUMAN_CONTACT_PHONE}*.`;

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
