import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
export const BOLD_ONLINE_BASE = 'https://api.online.payments.bold.co';
export async function boldOnlineRequest(
  key: string,
  path: string,
  body?: unknown,
): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`${BOLD_ONLINE_BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `x-api-key ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ServiceUnavailableException(
      'No se pudo contactar a Bold. Consulta el estado antes de generar otro QR.',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.errors?.length) {
    const code = String(data?.errors?.[0]?.code || response.status)
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 30);
    // Do not echo provider bodies: they may contain payer data or credentials.
    const hint = [401, 403].includes(response.status)
      ? 'Revisa la llave de identidad y la habilitación de API Pagos en línea/QR.'
      : 'Bold rechazó la solicitud. Revisa los datos del pagador y la habilitación de QR.';
    throw new BadGatewayException(`${hint} Código: ${code}.`);
  }
  if (!data || typeof data !== 'object')
    throw new BadGatewayException('Bold devolvió una respuesta inválida');
  return data.payload ?? data;
}
export function boldExpiry(value: unknown): Date {
  let millis: number;
  const text = String(value ?? '');
  if (/^\d+$/.test(text)) {
    const n = BigInt(text);
    millis = Number(
      n > 10000000000000000n ? n / 1000000n : n < 100000000000n ? n * 1000n : n,
    );
  } else millis = Date.parse(text);
  if (
    !Number.isFinite(millis) ||
    millis <= Date.now() ||
    millis > Date.now() + 7 * 86400000
  )
    throw new BadGatewayException(
      'Bold devolvió un vencimiento de QR inválido',
    );
  return new Date(millis);
}
export function safeQrImage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500000)
    throw new BadGatewayException('Bold no devolvió una imagen QR válida');
  const base64 = value.replace(/^data:image\/png;base64,/, '');
  if (
    !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64) ||
    Buffer.from(base64, 'base64').subarray(0, 8).toString('hex') !==
      '89504e470d0a1a0a'
  )
    throw new BadGatewayException('Bold devolvió un formato QR inesperado');
  return `data:image/png;base64,${base64}`;
}
