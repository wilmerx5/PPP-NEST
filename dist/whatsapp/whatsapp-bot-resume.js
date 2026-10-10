"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botResumeCustomerMessage = botResumeCustomerMessage;
const whatsapp_human_contact_1 = require("./whatsapp-human-contact");
function botResumeCustomerMessage(reason) {
    if (reason === 'agent_idle') {
        return ('Qué pena: por ahora no hay alguien disponible en este chat.\n\n' +
            `Puedo ayudarte yo con el pedido 🤖, o contáctanos al *${whatsapp_human_contact_1.WHATSAPP_HUMAN_CONTACT_PHONE}*.\n` +
            'Dime qué se te antoja (plato o código).');
    }
    return ('Listo, vuelves con el *asistente virtual* 🤖.\n\n' +
        `Cuando quieras, dime qué necesitas; si prefieres llamar: *${whatsapp_human_contact_1.WHATSAPP_HUMAN_CONTACT_PHONE}*.`);
}
//# sourceMappingURL=whatsapp-bot-resume.js.map