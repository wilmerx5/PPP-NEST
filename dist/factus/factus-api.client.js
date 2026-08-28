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
    async validateCreditNote(payload) {
        return this.requestJson('POST', '/v2/credit-notes/validate', payload);
    }
    async getBill(number) {
        const json = await this.requestJson('GET', `/v2/bills/${encodeURIComponent(number)}`);
        const data = json.data;
        if (!data?.number && !data?.customer) {
            throw new common_1.BadRequestException(`Factus no devolvió la factura ${number} para armar la nota crédito`);
        }
        return data;
    }
    async listNumberingRanges() {
        const json = await this.requestJson('GET', '/v2/numbering-ranges');
        const inner = json.data;
        if (Array.isArray(inner))
            return inner;
        if (inner && Array.isArray(inner.data))
            return inner.data;
        return json || [];
    }
    async sendBillEmail(number, email) {
        const paths = [
            `/v2/bills/send-email/${encodeURIComponent(number)}`,
            `/v2/bills/${encodeURIComponent(number)}/send-email`,
        ];
        let lastErr;
        for (const path of paths) {
            try {
                return await this.requestJson('POST', path, { email });
            }
            catch (err) {
                lastErr = err;
                this.logger.warn(`[Factus API] email path falló ${path}: ${err instanceof Error ? err.message : err}`);
            }
        }
        throw lastErr instanceof Error
            ? lastErr
            : new common_1.ServiceUnavailableException('No se pudo reenviar el correo');
    }
    async downloadBillPdf(number) {
        const paths = [
            `/v2/bills/download-pdf/${encodeURIComponent(number)}`,
            `/v2/bills/${encodeURIComponent(number)}/download-pdf`,
        ];
        let lastErr;
        for (const path of paths) {
            try {
                return await this.downloadPdfAt(path, number);
            }
            catch (err) {
                lastErr = err;
                this.logger.warn(`[Factus API] PDF path falló ${path}: ${err instanceof Error ? err.message : err}`);
            }
        }
        throw lastErr instanceof Error
            ? lastErr
            : new common_1.ServiceUnavailableException('No se pudo descargar el PDF de Factus');
    }
    async downloadPdfAt(path, number) {
        const token = await this.auth.getAccessToken();
        const url = `${this.auth.getBaseUrl()}${path}`;
        this.logger.log(`[Factus API] GET ${path}`);
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
            const text = await res.text();
            this.logger.error(`[Factus API] PDF FAIL ${path} → ${res.status}: ${text.slice(0, 500)}`);
            if (res.status >= 400 && res.status < 500) {
                throw new common_1.BadRequestException('No se pudo descargar el PDF de la factura');
            }
            throw new common_1.ServiceUnavailableException('No se pudo descargar el PDF de Factus');
        }
        const defaultName = `${number}.pdf`;
        if (contentType.includes('application/json')) {
            const json = (await res.json());
            const b64 = json.data?.pdf_base_64_encoded;
            if (!b64)
                throw new common_1.ServiceUnavailableException('Respuesta PDF sin contenido');
            return {
                buffer: Buffer.from(b64, 'base64'),
                fileName: json.data?.file_name || defaultName,
            };
        }
        const ab = await res.arrayBuffer();
        return { buffer: Buffer.from(ab), fileName: defaultName };
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