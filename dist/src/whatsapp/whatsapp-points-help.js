"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POINTS_PRODUCT_CODES = exports.POINTS_REQUIRED_FOR_PRIZE = void 0;
exports.buildPointsHelpUrl = buildPointsHelpUrl;
exports.buildPointsOverviewReply = buildPointsOverviewReply;
exports.buildRegisterPointSteps = buildRegisterPointSteps;
exports.buildRedeemSteps = buildRedeemSteps;
exports.formatPremioAppliedNote = formatPremioAppliedNote;
exports.formatCartNeedsHalfChickenForPremio = formatCartNeedsHalfChickenForPremio;
exports.POINTS_REQUIRED_FOR_PRIZE = 9;
exports.POINTS_PRODUCT_CODES = {
    individual: [1, 99, 4, 98, 89],
    pair: [2, 5],
};
function buildPointsHelpUrl(websiteUrl) {
    const base = (websiteUrl || '').trim().replace(/\/+$/, '');
    if (!base)
        return null;
    return `${base}/ayuda/puntos`;
}
function buildPointsOverviewReply(ctx) {
    const helpUrl = buildPointsHelpUrl(ctx.websiteUrl);
    const balance = ctx.availablePoints != null
        ? `\n\n📊 *Tu saldo:* ${ctx.availablePoints} punto(s) disponible(s). ` +
            `Con ${exports.POINTS_REQUIRED_FOR_PRIZE} puedes generar un premio (medio pollo gratis).`
        : '';
    const accountNote = ctx.linkedUserName
        ? `\n\n✅ Reconocí tu cuenta (*${ctx.linkedUserName}*). Puedo registrar códigos de factura y canjear puntos por aquí.`
        : `\n\nℹ️ Para *registrar puntos* de factura necesitas una cuenta web con el mismo celular de WhatsApp. ` +
            `Entra en la web → *Mis puntos* → *Registrar punto*.`;
    return (`*Programa de puntos y premios* 🎁\n\n` +
        `*¿Qué es?* Cada compra elegible suma puntos. Con *${exports.POINTS_REQUIRED_FOR_PRIZE} puntos* generas un *premio*: ` +
        `medio pollo gratis (producto código 2 o 5) en un pedido.\n\n` +
        `*¿Cómo acumulas?*\n` +
        `1️⃣ *Pedido web* (con tu usuario): los puntos se suman solos al pagar.\n` +
        `2️⃣ *Local / teléfono*: en la factura viene un código de *12 caracteres*. ` +
        `Regístralo en *Mis puntos* (web) o envíamelo aquí si tu cuenta está vinculada.\n\n` +
        `*¿Qué platos suman?*\n` +
        `• Códigos ${exports.POINTS_PRODUCT_CODES.individual.join(', ')}: *1 punto* cada uno.\n` +
        `• Códigos 2 y 5 *juntos* en la misma compra: *1 punto* (medio pollo).\n\n` +
        `*¿Cómo usar un premio?*\n` +
        `1. Junta ${exports.POINTS_REQUIRED_FOR_PRIZE} puntos → *redimir* (genera un código de premio, válido 30 días).\n` +
        `2. Pide incluyendo *medio pollo* (cód. 2 o 5) y aplica el código al confirmar.\n` +
        `3. El medio pollo queda en *$0*; lo demás se paga normal.\n\n` +
        `*Comandos por aquí:*\n` +
        `• *mis puntos* — ver saldo\n` +
        `• *registrar* + código de 12 caracteres — sumar punto de factura\n` +
        `• *redimir* — cambiar ${exports.POINTS_REQUIRED_FOR_PRIZE} puntos por premio\n` +
        `• *premio* + código — aplicar premio a tu pedido (con medio pollo en el carrito)\n` +
        `• *quitar premio* — quitar premio anotado\n\n` +
        `⚠️ Un código de factura o premio solo sirve *una vez*. Redimir ≠ usar el premio: primero generas el código, luego lo aplicas al pedir.` +
        balance +
        accountNote +
        (helpUrl ? `\n\n📖 Guía completa: ${helpUrl}` : ''));
}
function buildRegisterPointSteps(ctx) {
    const helpUrl = buildPointsHelpUrl(ctx.websiteUrl);
    if (ctx.linkedUserName) {
        return (`Para *registrar un punto* de factura:\n\n` +
            `1. Busca el código de *12 caracteres* en tu ticket (letras y números).\n` +
            `2. Escríbelo aquí, por ejemplo:\n` +
            `   _registrar A3F9K2M8P1Q7_\n` +
            `   o solo el código si es lo único del mensaje.\n` +
            `3. Si es válido y no se ha usado, suma *1 punto* a tu cuenta.\n\n` +
            `Cuenta vinculada: *${ctx.linkedUserName}*.`);
    }
    return (`Para registrar puntos de factura necesitas *cuenta en la web* con el mismo celular de este WhatsApp.\n\n` +
        `Pasos:\n` +
        `1. Crea o entra a tu cuenta en la web.\n` +
        `2. Ve a *Mis puntos* → *Registrar punto*.\n` +
        `3. Pega el código de 12 caracteres de tu factura.\n\n` +
        (helpUrl ? `Guía: ${helpUrl}\n\n` : '') +
        `Cuando tu cuenta esté vinculada, también podrás registrar códigos por aquí.`);
}
function buildRedeemSteps(available) {
    if (available < exports.POINTS_REQUIRED_FOR_PRIZE) {
        const missing = exports.POINTS_REQUIRED_FOR_PRIZE - available;
        return (`Tienes *${available}* punto(s) disponible(s). ` +
            `Necesitas *${exports.POINTS_REQUIRED_FOR_PRIZE}* para redimir.\n\n` +
            `Te faltan *${missing}*. Sigue acumulando con compras elegibles o registrando códigos de factura.`);
    }
    return (`Tienes *${available}* puntos ✅\n\n` +
        `Escribe *redimir* para generar tu premio (gasta ${exports.POINTS_REQUIRED_FOR_PRIZE} puntos). ` +
        `Te daré un código de 12 caracteres válido *30 días*.\n\n` +
        `Luego pide un *medio pollo* (cód. 2 o 5) y envía *premio* + ese código, o escríbelo al confirmar el pedido.`);
}
function formatPremioAppliedNote(code, expiresAt) {
    const exp = expiresAt
        ? `\nVence: ${expiresAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : '';
    return (`🎁 *Premio anotado:* \`${code}\`${exp}\n` +
        `Se aplicará al confirmar si tu carrito lleva *medio pollo* (cód. 2 o 5).`);
}
function formatCartNeedsHalfChickenForPremio() {
    return (`Tu premio está anotado, pero el carrito aún no lleva *medio pollo* (producto código *2* o *5*).\n\n` +
        `Agrega uno y al confirmar el premio se aplicará automáticamente.`);
}
//# sourceMappingURL=whatsapp-points-help.js.map