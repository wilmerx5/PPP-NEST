"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DbExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
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
let DbExceptionFilter = DbExceptionFilter_1 = class DbExceptionFilter {
    logger = new common_1.Logger(DbExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();
        const driverError = exception.driverError;
        const code = driverError?.code ?? exception.code;
        const errno = driverError?.errno;
        const isTransient = TRANSIENT_CODES.has(String(code)) ||
            (typeof errno === 'number' && (errno === -104 || errno === -111));
        if (isTransient) {
            this.logger.warn(`[DB transitorio] ${code ?? 'unknown'} en ${req.method} ${req.url} – ${exception.message}`);
            res.setHeader('Retry-After', '5');
            res.status(common_1.HttpStatus.SERVICE_UNAVAILABLE).json({
                statusCode: common_1.HttpStatus.SERVICE_UNAVAILABLE,
                message: 'Error temporal de base de datos. Reintenta en unos segundos.',
                error: 'Servicio no disponible',
            });
            return;
        }
        this.logger.error(`[DB] ${code ?? 'unknown'} en ${req.method} ${req.url} – ${exception.message}`);
        const sqlMessage = String(driverError?.sqlMessage ?? exception.message ?? '');
        const looksLikeMissingScheduleSchema = /has_schedule|ppp_product_schedules/i.test(sqlMessage);
        if (code === 'ER_NO_REFERENCED_ROW' || code === 'ER_NO_REFERENCED_ROW_2' || errno === 1452) {
            res.status(common_1.HttpStatus.BAD_REQUEST).json({
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                message: 'Referencia inválida (p. ej. producto relacionado inexistente).',
                error: 'Solicitud incorrecta',
            });
            return;
        }
        if (code === 'ER_BAD_FIELD_ERROR' || errno === 1054) {
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: looksLikeMissingScheduleSchema
                    ? 'Falta la columna has_schedule. Ejecuta la migración 018_add_product_has_schedule.sql.'
                    : 'Falta una columna en la base de datos. Revisa migraciones pendientes.',
                error: 'Error interno del servidor',
            });
            return;
        }
        if (code === 'ER_NO_SUCH_TABLE' || errno === 1146) {
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: looksLikeMissingScheduleSchema
                    ? 'Falta la tabla ppp_product_schedules. Ejecuta la migración 019_create_product_schedules.sql.'
                    : 'Falta una tabla en la base de datos. Revisa migraciones pendientes.',
                error: 'Error interno del servidor',
            });
            return;
        }
        res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Error de base de datos',
            error: 'Error interno del servidor',
        });
    }
};
exports.DbExceptionFilter = DbExceptionFilter;
exports.DbExceptionFilter = DbExceptionFilter = DbExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(typeorm_1.QueryFailedError)
], DbExceptionFilter);
//# sourceMappingURL=db-exception.filter.js.map