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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const common_service_1 = require("./common.service");
let CommonController = class CommonController {
    commonService;
    dataSource;
    constructor(commonService, dataSource) {
        this.commonService = commonService;
        this.dataSource = dataSource;
    }
    async dbHealth(samplesRaw) {
        const samples = Math.min(Math.max(Number(samplesRaw) || 10, 1), 50);
        const pingMs = [];
        for (let i = 0; i < samples; i++) {
            const start = Date.now();
            await this.dataSource.query('SELECT 1');
            pingMs.push(Date.now() - start);
        }
        let dailyMaxMs = -1;
        try {
            const start = Date.now();
            await this.dataSource.query('SELECT MAX(daily_order_number) AS m FROM ppp_orders WHERE created_at > (NOW() - INTERVAL 1 DAY)');
            dailyMaxMs = Date.now() - start;
        }
        catch {
            dailyMaxMs = -1;
        }
        const sorted = [...pingMs].sort((a, b) => a - b);
        const sum = pingMs.reduce((a, b) => a + b, 0);
        const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
        const avg = sum / pingMs.length;
        let verdict;
        if (avg < 5)
            verdict = 'excelente (DB local / misma región)';
        else if (avg < 20)
            verdict = 'buena';
        else if (avg < 50)
            verdict = 'aceptable';
        else
            verdict = 'ALTA: DB remota — cada orden acumula segundos por las múltiples consultas';
        return {
            samples,
            roundTripMs: {
                min: sorted[0],
                avg: Number(avg.toFixed(1)),
                p50: p(0.5),
                p95: p(0.95),
                max: sorted[sorted.length - 1],
                all: pingMs,
            },
            dailyOrderMaxQueryMs: dailyMaxMs,
            note: 'Una orden ejecuta ~15-25 consultas en secuencia. Tiempo mínimo estimado ≈ avg × 20.',
            estimatedOrderNetworkFloorMs: Number((avg * 20).toFixed(0)),
            verdict,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.CommonController = CommonController;
__decorate([
    (0, common_1.Get)('db-health'),
    (0, swagger_1.ApiOperation)({ summary: 'Latencia round-trip a la base de datos (diagnóstico)' }),
    (0, swagger_1.ApiQuery)({ name: 'samples', required: false, example: 10 }),
    __param(0, (0, common_1.Query)('samples')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CommonController.prototype, "dbHealth", null);
exports.CommonController = CommonController = __decorate([
    (0, swagger_1.ApiTags)('diagnostics'),
    (0, common_1.Controller)('common'),
    __metadata("design:paramtypes", [common_service_1.CommonService,
        typeorm_1.DataSource])
], CommonController);
//# sourceMappingURL=common.controller.js.map