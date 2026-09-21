import {
  scrubAiDisclaimerCopy,
  scrubAsesorHandoffCopy,
  scrubOutboundAsesorMentions,
  WHATSAPP_AI_DISCLAIMER_SAFE,
  WHATSAPP_HUMAN_CONTACT_MESSAGE,
} from './whatsapp-human-contact';
import { botResumeCustomerMessage } from './whatsapp-bot-resume';

describe('whatsapp-human-contact (ASESOR off)', () => {
  it('limpia handoff viejo de BD', () => {
    expect(
      scrubAsesorHandoffCopy(
        'Dale, te paso con el equipo 🙋. Alguien te va a atender por aquí; puedes seguir escribiendo.',
      ),
    ).toBe(WHATSAPP_HUMAN_CONTACT_MESSAGE);
    expect(scrubAsesorHandoffCopy('Escribe *ASESOR* si quieres una persona.')).toBe(
      WHATSAPP_HUMAN_CONTACT_MESSAGE,
    );
    expect(scrubAsesorHandoffCopy(WHATSAPP_HUMAN_CONTACT_MESSAGE)).toBe(
      WHATSAPP_HUMAN_CONTACT_MESSAGE,
    );
  });

  it('limpia disclaimer con ASESOR (copia larga de BD)', () => {
    expect(
      scrubAiDisclaimerCopy(
        '⚠️ Chat con *IA* (en prueba; puede fallar). Si prefieres persona: *ASESOR*.',
      ),
    ).toBe(WHATSAPP_AI_DISCLAIMER_SAFE);
    expect(
      scrubAiDisclaimerCopy(
        '⚠️ *Aviso:* este chat lo atiende una *inteligencia artificial* y todavía está en *fase de implementación*, así que puede cometer errores.\n\n' +
          'Si algo no cuadra o prefieres una persona, escribe *asesor* y te pasamos con el equipo.',
      ),
    ).toBe(WHATSAPP_AI_DISCLAIMER_SAFE);
  });

  it('resume idle no menciona ASESOR', () => {
    const idle = botResumeCustomerMessage('agent_idle');
    const manual = botResumeCustomerMessage('manual');
    expect(idle).not.toMatch(/asesor/i);
    expect(manual).not.toMatch(/asesor/i);
    expect(idle).toMatch(/3118866823/);
    expect(manual).toMatch(/3118866823/);
  });

  it('limpia replies salientes que ofrecen ASESOR', () => {
    expect(
      scrubOutboundAsesorMentions(
        'Dale, te paso con el equipo 🙋. Alguien te va a atender por aquí.',
      ),
    ).toBe(WHATSAPP_HUMAN_CONTACT_MESSAGE);
    const mixed = scrubOutboundAsesorMentions(
      'Perdona. ¿Quieres que te pase con un ASESOR otra vez o prefieres que yo te ayude? El 1/2 Broaster trae papa.',
    );
    expect(mixed).not.toMatch(/asesor/i);
    expect(mixed).toMatch(/3118866823|Broaster|papa/i);
  });
});
