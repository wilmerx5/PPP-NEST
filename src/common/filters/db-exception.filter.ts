import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Códigos de error de MySQL/mysql2 que suelen ser transitorios (conexión cerrada, red, etc.) */
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
  'ER_LOCK_WAIT_TIMEOUT',
]);

@Catch(QueryFailedError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest();
    const driverError = (exception as any).driverError;
    const code = driverError?.code ?? (exception as any).code;
    const errno = driverError?.errno;

    const isTransient =
      TRANSIENT_CODES.has(String(code)) ||
      (typeof errno === 'number' && (errno === -104 || errno === -111));

    if (isTransient) {
      this.logger.warn(
        `[DB transitorio] ${code ?? 'unknown'} en ${req.method} ${req.url} – ${(exception as Error).message}`,
      );
      res.setHeader('Retry-After', '5');
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Error temporal de base de datos. Reintenta en unos segundos.',
        error: 'Servicio no disponible',
      });
      return;
    }

    this.logger.error(
      `[DB] ${code ?? 'unknown'} en ${req.method} ${req.url} – ${(exception as Error).message}`,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error de base de datos',
      error: 'Error interno del servidor',
    });
  }
}
