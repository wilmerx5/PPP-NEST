"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedCorsOrigin = isAllowedCorsOrigin;
function parseExtraOrigins() {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
const STATIC_ALLOWED = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:3001',
    'http://localhost:3000',
    'https://unperemptory-premorally-january.ngrok-free.dev',
    'https://prontopolloportal.com',
];
function isAllowedCorsOrigin(origin) {
    if (!origin)
        return true;
    const extra = parseExtraOrigins();
    if (extra.includes(origin))
        return true;
    if (STATIC_ALLOWED.includes(origin))
        return true;
    const hostname = origin.replace(/^https?:\/\//, '');
    const isProdSubdomain = /\.prontopolloportal\.com(:\d+)?$/.test(hostname);
    const isLocalhostSubdomain = /\.localhost(:\d+)?$/.test(hostname);
    const isPppLocalSubdomain = /\.ppp\.local(:\d+)?$/.test(hostname);
    const isNgrok = /\.ngrok-free\.dev$/.test(hostname) ||
        /\.ngrok-free\.app$/.test(hostname) ||
        /\.ngrok\.io$/.test(hostname) ||
        /\.ngrok\.app$/.test(hostname);
    return (isProdSubdomain ||
        isLocalhostSubdomain ||
        isPppLocalSubdomain ||
        isNgrok);
}
//# sourceMappingURL=cors-allowed.js.map