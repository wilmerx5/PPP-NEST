/** Mensajes al cliente cuando el bot retoma tras atención humana. */

export function botResumeCustomerMessage(reason: 'manual' | 'agent_idle'): string {
  if (reason === 'agent_idle') {
    return (
      'El asesor concluyó la asistencia por inactividad.\n\n' +
      'Vuelves a ser atendido por nuestro *asistente virtual* 🤖. ' +
      'Si necesitas una persona otra vez, escribe *ASESOR*.'
    );
  }
  return (
    'El asesor concluyó su asistencia.\n\n' +
    'Vuelves a ser atendido por nuestro *asistente virtual* 🤖. ' +
    'Cuando quieras, dime qué necesitas; si prefieres una persona, escribe *ASESOR*.'
  );
}
