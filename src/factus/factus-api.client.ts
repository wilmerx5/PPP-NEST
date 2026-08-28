import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FactusAuthService } from './factus-auth.service';
import type {
  FactusBillDetail,
  FactusDownloadPdfResponse,
  FactusNumberingRange,
  FactusValidateBillRequest,
  FactusValidateBillResponse,
  FactusValidateCreditNoteRequest,
  FactusValidateCreditNoteResponse,
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

  async validateCreditNote(
    payload: FactusValidateCreditNoteRequest,
  ): Promise<FactusValidateCreditNoteResponse> {
    return this.requestJson<FactusValidateCreditNoteResponse>(
      'POST',
      '/v2/credit-notes/validate',
      payload,
    );
  }

  /** GET /v2/bills/:number — datos del adquiriente de la FE ya emitida. */
  async getBill(number: string): Promise<FactusBillDetail> {
    const json = await this.requestJson<{ data?: FactusBillDetail }>(
      'GET',
      `/v2/bills/${encodeURIComponent(number)}`,
    );
    const data = json.data;
    if (!data?.number && !data?.customer) {
      throw new BadRequestException(
        `Factus no devolvió la factura ${number} para armar la nota crédito`,
      );
    }
    return data;
  }

  async listNumberingRanges(): Promise<FactusNumberingRange[]> {
    const json = await this.requestJson<{
      data?: FactusNumberingRange[] | { data?: FactusNumberingRange[] };
    }>('GET', '/v2/numbering-ranges');
    const inner = json.data;
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray(inner.data)) return inner.data;
    return (json as unknown as FactusNumberingRange[]) || [];
  }

  async sendBillEmail(number: string, email: string): Promise<{ message?: string }> {
    const paths = [
      `/v2/bills/send-email/${encodeURIComponent(number)}`,
      `/v2/bills/${encodeURIComponent(number)}/send-email`,
    ];
    let lastErr: unknown;
    for (const path of paths) {
      try {
        return await this.requestJson('POST', path, { email });
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `[Factus API] email path falló ${path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new ServiceUnavailableException('No se pudo reenviar el correo');
  }

  /**
   * Descarga PDF de factura. Factus suele devolver JSON con base64.
   * Prueba ambas rutas conocidas de la API.
   */
  async downloadBillPdf(number: string): Promise<{ buffer: Buffer; fileName: string }> {
    const paths = [
      `/v2/bills/download-pdf/${encodeURIComponent(number)}`,
      `/v2/bills/${encodeURIComponent(number)}/download-pdf`,
    ];
    let lastErr: unknown;
    for (const path of paths) {
      try {
        return await this.downloadPdfAt(path, number);
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `[Factus API] PDF path falló ${path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new ServiceUnavailableException('No se pudo descargar el PDF de Factus');
  }

  private async downloadPdfAt(
    path: string,
    number: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
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
        throw new BadRequestException('No se pudo descargar el PDF de la factura');
      }
      throw new ServiceUnavailableException('No se pudo descargar el PDF de Factus');
    }
    const defaultName = `${number}.pdf`;
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as FactusDownloadPdfResponse;
      const b64 = json.data?.pdf_base_64_encoded;
      if (!b64) throw new ServiceUnavailableException('Respuesta PDF sin contenido');
      return {
        buffer: Buffer.from(b64, 'base64'),
        fileName: json.data?.file_name || defaultName,
      };
    }
    const ab = await res.arrayBuffer();
    return { buffer: Buffer.from(ab), fileName: defaultName };
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
