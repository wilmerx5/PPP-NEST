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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const app_service_1 = require("./app.service");
const circuit_breaker_service_1 = require("./common/circuit-breaker/circuit-breaker.service");
const cache_service_1 = require("./common/cache/cache.service");
let AppController = class AppController {
    appService;
    dataSource;
    circuitBreaker;
    cache;
    constructor(appService, dataSource, circuitBreaker, cache) {
        this.appService = appService;
        this.dataSource = dataSource;
        this.circuitBreaker = circuitBreaker;
        this.cache = cache;
    }
    async health() {
        try {
            await this.dataSource.query('SELECT 1');
            const memUsage = process.memoryUsage();
            const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
            return {
                status: 'ok',
                db: 'connected',
                circuitBreaker: this.circuitBreaker.getState(),
                cacheSize: this.cache.size(),
                memory: {
                    heapUsed: mb(memUsage.heapUsed),
                    heapTotal: mb(memUsage.heapTotal),
                    rss: mb(memUsage.rss),
                },
                timestamp: new Date().toISOString(),
            };
        }
        catch {
            throw new common_1.ServiceUnavailableException({
                status: 'degraded',
                db: 'disconnected',
                circuitBreaker: this.circuitBreaker.getState(),
                timestamp: new Date().toISOString(),
            });
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "health", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        typeorm_1.DataSource,
        circuit_breaker_service_1.CircuitBreakerService,
        cache_service_1.CacheService])
], AppController);
//# sourceMappingURL=app.controller.js.map