/** Mensajes al cliente cuando el bot retoma tras atención humana. */

import { WHATSAPP_HUMAN_CONTACT_PHONE } from './whatsapp-human-contact';

export function botResumeCustomerMessage(reason: 'manual' | 'agent_idle'): string {
  if (reason === 'agent_idle') {
    return (
      'Qué pena: por ahora no hay alguien disponible en este chat.\n\n' +
      `Puedo ayudarte yo con el pedido 🤖, o contáctanos al *${WHATSAPP_HUMAN_CONTACT_PHONE}*.\n` +
      'Dime qué se te antoja (plato o código).'
    );
  }
  return (
    'Listo, vuelves con el *asistente virtual* 🤖.\n\n' +
    `Cuando quieras, dime qué necesitas; si prefieres llamar: *${WHATSAPP_HUMAN_CONTACT_PHONE}*.`
  );
}
