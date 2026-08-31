"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botResumeCustomerMessage = botResumeCustomerMessage;
function botResumeCustomerMessage(reason) {
    if (reason === 'agent_idle') {
        return ('El asesor concluyó la asistencia por inactividad.\n\n' +
            'Vuelves a ser atendido por nuestro *asistente virtual* 🤖. ' +
            'Si necesitas una persona otra vez, escribe *ASESOR*.');
    }
    return ('El asesor concluyó su asistencia.\n\n' +
        'Vuelves a ser atendido por nuestro *asistente virtual* 🤖. ' +
        'Cuando quieras, dime qué necesitas; si prefieres una persona, escribe *ASESOR*.');
}
//# sourceMappingURL=whatsapp-bot-resume.js.map