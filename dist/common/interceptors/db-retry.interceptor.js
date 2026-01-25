"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbRetryInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const typeorm_1 = require("typeorm");
function isTransientDbError(err) {
    if (!(err instanceof typeorm_1.QueryFailedError))
        return false;
    const e = err.driverError;
    const code = e?.code ?? err.code;
    const errno = e?.errno;
    return (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(String(code)) ||
        (typeof errno === 'number' && (errno === -104 || errno === -111)));
}
let DbRetryInterceptor = class DbRetryInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const isGet = request.method === 'GET' || request.method === 'HEAD';
        if (!isGet) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.retry)({
            count: 1,
            delay: (err) => {
                if (!isTransientDbError(err))
                    return (0, rxjs_1.throwError)(() => err);
                return (0, rxjs_1.timer)(300);
            },
        }));
    }
};
exports.DbRetryInterceptor = DbRetryInterceptor;
exports.DbRetryInterceptor = DbRetryInterceptor = __decorate([
    (0, common_1.Injectable)()
], DbRetryInterceptor);
//# sourceMappingURL=db-retry.interceptor.js.map