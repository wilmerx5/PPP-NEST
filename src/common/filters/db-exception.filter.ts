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

    const sqlMessage = String(driverError?.sqlMessage ?? (exception as Error).message ?? '');
    const looksLikeMissingScheduleSchema =
      /has_schedule|ppp_product_schedules/i.test(sqlMessage);

    if (code === 'ER_NO_REFERENCED_ROW' || code === 'ER_NO_REFERENCED_ROW_2' || errno === 1452) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Referencia inválida (p. ej. producto relacionado inexistente).',
        error: 'Solicitud incorrecta',
      });
      return;
    }

    if (code === 'ER_BAD_FIELD_ERROR' || errno === 1054) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: looksLikeMissingScheduleSchema
          ? 'Falta la columna has_schedule. Ejecuta la migración 018_add_product_has_schedule.sql.'
          : 'Falta una columna en la base de datos. Revisa migraciones pendientes.',
        error: 'Error interno del servidor',
      });
      return;
    }

    if (code === 'ER_NO_SUCH_TABLE' || errno === 1146) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: looksLikeMissingScheduleSchema
          ? 'Falta la tabla ppp_product_schedules. Ejecuta la migración 019_create_product_schedules.sql.'
          : 'Falta una tabla en la base de datos. Revisa migraciones pendientes.',
        error: 'Error interno del servidor',
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error de base de datos',
      error: 'Error interno del servidor',
    });
  }
}
