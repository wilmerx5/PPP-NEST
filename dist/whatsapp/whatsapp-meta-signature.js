"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWhatsappMetaSignature = verifyWhatsappMetaSignature;
const crypto = require("crypto");
function verifyWhatsappMetaSignature(rawBody, signatureHeader, appSecret) {
    const secret = (appSecret || '').trim();
    const header = (signatureHeader || '').trim();
    if (!secret || !header)
        return false;
    if (!header.startsWith('sha256='))
        return false;
    const receivedHex = header.slice('sha256='.length).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(receivedHex))
        return false;
    const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    const expectedHex = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expectedHex, 'utf8'), Buffer.from(receivedHex, 'utf8'));
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=whatsapp-meta-signature.js.map