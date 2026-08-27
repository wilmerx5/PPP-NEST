import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FactusAuthService } from './factus-auth.service';
import type {
  FactusNumberingRange,
  FactusValidateBillRequest,
  FactusValidateBillResponse,
} from './types/factus.types';

@Injectable()
export class FactusApiClient {
  private readonly logger = new Logger(FactusApiClient.name);

  constructor(private readonly auth: FactusAuthService) {}

  async validateBill(
    payload: FactusValidateBillRequest,
  ): Promise<FactusValidateBillResponse> {
    return this.requestJson<FactusValidateBillResponse>(
      'POST',
      '/v2/bills/validate',
      payload,
    );
  }

  async listNumberingRanges(): Promise<FactusNumberingRange[]> {
    const data = await this.requestJson<{ data?: FactusNumberingRange[] }>(
      'GET',
      '/v2/numbering-ranges',
    );
    return data.data || (data as unknown as FactusNumberingRange[]) || [];
  }

  async downloadBillPdf(number: string): Promise<Buffer> {
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
      throw new ServiceUnavailableException('No se pudo descargar el PDF de Factus');
    }
    // Algunos endpoints devuelven JSON con base64; otros binario.
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as { data?: { pdf_base_64_encoded?: string } };
      const b64 = json.data?.pdf_base_64_encoded;
      if (!b64) throw new ServiceUnavailableException('Respuesta PDF sin contenido');
      return Buffer.from(b64, 'base64');
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<T> {
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
      return this.requestJson<T>(method, path, body, true);
    }

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }

    const ms = Date.now() - started;
    if (!res.ok) {
      // Log completo del error (hasta 4k) para depurar en docker logs
      this.logger.error(
        `[Factus API] FAIL ${method} ${path} → HTTP ${res.status} (${ms}ms)\n${text.slice(0, 4000)}`,
      );
      const msg =
        (json as { message?: string })?.message ||
        (json as { error?: string })?.error ||
        `Error Factus (${res.status})`;
      if (res.status >= 400 && res.status < 500) {
        throw new BadRequestException(msg);
      }
      throw new ServiceUnavailableException(msg);
    }

    this.logger.log(`[Factus API] OK ${method} ${path} → HTTP ${res.status} (${ms}ms)`);
    if (debug) {
      this.logger.debug(`[Factus API] response: ${text.slice(0, 2000)}`);
    }
    return json as T;
  }
}
