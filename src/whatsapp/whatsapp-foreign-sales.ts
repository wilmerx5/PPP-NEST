/** Commercial outreach is not a food order, whether sent by a human or a bot. */
const key = (text: string): string => text.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function isForeignSalesPitch(text: string): boolean {
  const said = key(text);
  // A customer's occupation must not prevent an explicit purchase request.
  if (/\b(?:quiero|quisiera)\s+(?:pedir|ordenar|comprar comida)\b/.test(said)) return false;
  const service = /\b(?:plan(?:es)? (?:ilimitad[oa]s?|pospago|movil|moviles|celular|de (?:celular|telefonia))|telefonia|operador movil|\d+\s*gb)\b/.test(said);
  const offers = /\b(?:soy|somos|vendo|vendemos|ofrezco|ofrecemos|te ofrezco|tenemos|asesor|asesora|primer mes gratis|conserva tu numero)\b/.test(said);
  return service && offers;
}

/** Only used after an explicit sales pitch, never as a standalone spam classifier. */
export function isForeignSalesFollowup(text: string): boolean {
  const said = key(text);
  return /^(?:si|no|ok|vale|listo|por favor|confirmar|confirmo|[0-9]{1,3})$/.test(said) ||
    /\b(?:canal de operador movil|canal para planes|te nos fuiste|oferta del dia|clic al boton|no hemos recibido respuesta|agente especializado|tu compra|te llamo|sigue en linea|sigues (?:ahi|en linea)|gracias por tu tiempo|puedo ayudarte|pueda ayudarte)\b/.test(said) ||
    /^(?:(?:hola|buenas|buenos dias|buenas tardes|buenas noches|entendido|entiendo|perfecto|gracias|muchas gracias|sin problema|que tengas un buen dia|que tengas un excelente dia)\s*)+$/.test(said);
}
