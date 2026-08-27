"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FactusApiClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactusApiClient = void 0;
const common_1 = require("@nestjs/common");
const factus_auth_service_1 = require("./factus-auth.service");
let FactusApiClient = FactusApiClient_1 = class FactusApiClient {
    auth;
    logger = new common_1.Logger(FactusApiClient_1.name);
    constructor(auth) {
        this.auth = auth;
    }
    async validateBill(payload) {
        return this.requestJson('POST', '/v2/bills/validate', payload);
    }
    async listNumberingRanges() {
        const data = await this.requestJson('GET', '/v2/numbering-ranges');
        return data.data || data || [];
    }
    async downloadBillPdf(number) {
        const token = await this.auth.getAccessToken();
        const url = `${this.auth.getBaseUrl()}/v2/bills/download-pdf/${encodeURIComponent(number)}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });
        if (!res.ok) {
            const text = await res.text();
            this.logger.error(`Factus PDF ${res.status}: ${text}`);
            throw new common_1.ServiceUnavailableException('No se pudo descargar el PDF de Factus');
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = (await res.json());
            const b64 = json.data?.pdf_base_64_encoded;
            if (!b64)
                throw new common_1.ServiceUnavailableException('Respuesta PDF sin contenido');
            return Buffer.from(b64, 'base64');
        }
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    }
    async requestJson(method, path, body, retried = false) {
        const debug = (process.env.FACTUS_DEBUG || '').toLowerCase() === 'true';
        const token = await this.auth.getAccessToken();
        const url = `${this.auth.getBaseUrl()}${path}`;
        this.logger.log(`[Factus API] ${method} ${path}${retried ? ' (retry auth)' : ''}`);
        if (debug && body) {
            this.logger.debug(`[Factus API] body: ${JSON.stringify(body)}`);
        }
        const started = Date.now();
        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (res.status === 401 && !retried) {
            this.logger.warn('[Factus API] 401 — invalidando token y reintentando');
            this.auth.invalidateToken();
            return this.requestJson(method, path, body, true);
        }
        const text = await res.text();
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        }
        catch {
            json = { message: text };
        }
        const ms = Date.now() - started;
        if (!res.ok) {
            this.logger.error(`[Factus API] FAIL ${method} ${path} → HTTP ${res.status} (${ms}ms)\n${text.slice(0, 4000)}`);
            const msg = json?.message ||
                json?.error ||
                `Error Factus (${res.status})`;
            if (res.status >= 400 && res.status < 500) {
                throw new common_1.BadRequestException(msg);
            }
            throw new common_1.ServiceUnavailableException(msg);
        }
        this.logger.log(`[Factus API] OK ${method} ${path} → HTTP ${res.status} (${ms}ms)`);
        if (debug) {
            this.logger.debug(`[Factus API] response: ${text.slice(0, 2000)}`);
        }
        return json;
    }
};
exports.FactusApiClient = FactusApiClient;
exports.FactusApiClient = FactusApiClient = FactusApiClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [factus_auth_service_1.FactusAuthService])
], FactusApiClient);
//# sourceMappingURL=factus-api.client.js.map