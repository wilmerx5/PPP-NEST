"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNewOpenAiTokenModel = isNewOpenAiTokenModel;
exports.openAiRejectsCustomTemperature = openAiRejectsCustomTemperature;
exports.applyOpenAiChatCompat = applyOpenAiChatCompat;
function isNewOpenAiTokenModel(model) {
    const m = (model || '').trim().toLowerCase();
    return (/^gpt-5/.test(m) ||
        /^o1/.test(m) ||
        /^o3/.test(m) ||
        /^o4/.test(m) ||
        m.includes('gpt-5'));
}
function openAiRejectsCustomTemperature(model) {
    return isNewOpenAiTokenModel(model);
}
function applyOpenAiChatCompat(body, opts) {
    const model = opts.model || String(body.model || 'gpt-4o-mini');
    body.model = model;
    const maxOut = opts.maxOutputTokens;
    if (maxOut != null && maxOut > 0) {
        if (isNewOpenAiTokenModel(model)) {
            body.max_completion_tokens = maxOut;
            delete body.max_tokens;
        }
        else {
            body.max_tokens = maxOut;
            delete body.max_completion_tokens;
        }
    }
    if (opts.temperature != null && !openAiRejectsCustomTemperature(model)) {
        body.temperature = opts.temperature;
    }
    else {
        delete body.temperature;
    }
    return body;
}
//# sourceMappingURL=whatsapp-openai-compat.js.map