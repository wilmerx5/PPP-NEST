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
exports.PointsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const points_service_1 = require("./services/points.service");
const auth_decorator_1 = require("./decorators/auth.decorator");
let PointsController = class PointsController {
    pointsService;
    constructor(pointsService) {
        this.pointsService = pointsService;
    }
    async getTotalPoints(req) {
        const user = req.user;
        const total = await this.pointsService.getTotalPoints(user.id);
        return {
            totalPoints: total,
            userId: user.id,
        };
    }
    async getPointsHistory(req) {
        const user = req.user;
        const history = await this.pointsService.getPointsHistory(user.id);
        const total = await this.pointsService.getTotalPoints(user.id);
        return {
            history,
            total,
        };
    }
    async registerPointByCode(req, body) {
        const user = req.user;
        const { code } = body;
        if (!code || typeof code !== 'string') {
            throw new common_1.BadRequestException('Point code is required');
        }
        const pointRecord = await this.pointsService.registerPointByCode(user.id, code.toUpperCase().trim());
        const newTotal = await this.pointsService.getTotalPoints(user.id);
        return {
            success: true,
            message: 'Point registered successfully',
            pointRecord,
            newTotal,
        };
    }
    async getAvailablePoints(req) {
        const user = req.user;
        const available = await this.pointsService.getAvailablePoints(user.id);
        const total = await this.pointsService.getTotalPoints(user.id);
        return {
            availablePoints: available,
            totalPoints: total,
            userId: user.id,
        };
    }
    async redeemPoints(req) {
        const user = req.user;
        const redemption = await this.pointsService.redeemPointsForVoucher(user.id);
        const newTotal = await this.pointsService.getTotalPoints(user.id);
        const available = await this.pointsService.getAvailablePoints(user.id);
        return {
            success: true,
            message: 'Points redeemed successfully. You now have a prize for a free half chicken!',
            redemption: {
                code: redemption.code,
                createdAt: redemption.createdAt,
                expiresAt: redemption.expiresAt,
            },
            newTotal,
            availablePoints: available,
        };
    }
    async getRedemptions(req) {
        const user = req.user;
        const all = await this.pointsService.getUserRedemptions(user.id);
        const active = await this.pointsService.getActiveRedemptions(user.id);
        return {
            all,
            active,
        };
    }
    async validateRedemption(req, body) {
        const { code } = body;
        if (!code || typeof code !== 'string') {
            throw new common_1.BadRequestException('Redemption code is required');
        }
        const redemption = await this.pointsService.validateRedemptionCode(code.toUpperCase().trim());
        return {
            valid: true,
            code: redemption.code,
            expiresAt: redemption.expiresAt,
            message: 'Redemption code is valid and can be used',
        };
    }
};
exports.PointsController = PointsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get total points for authenticated user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Total points retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "getTotalPoints", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get points history for authenticated user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Points history retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "getPointsHistory", null);
__decorate([
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a point manually by code (for internal orders)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Point registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid code' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Point code not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Point code already used or registered' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "registerPointByCode", null);
__decorate([
    (0, common_1.Get)('available'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available points (not canceled, not redeemed) for authenticated user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Available points retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "getAvailablePoints", null);
__decorate([
    (0, common_1.Post)('redeem'),
    (0, swagger_1.ApiOperation)({ summary: 'Redeem 9 points for a prize (half chicken free)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Points redeemed successfully, prize created' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Not enough points to redeem' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "redeemPoints", null);
__decorate([
    (0, common_1.Get)('redemptions'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all redemption prizes for authenticated user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Redemption prizes retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "getRedemptions", null);
__decorate([
    (0, common_1.Post)('validate-redemption'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a redemption code (for applying to orders)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Redemption code is valid' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid or expired code' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Redemption code not found' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Redemption code already used' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PointsController.prototype, "validateRedemption", null);
exports.PointsController = PointsController = __decorate([
    (0, swagger_1.ApiTags)('User Points'),
    (0, common_1.Controller)('auth/points'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [points_service_1.PointsService])
], PointsController);
//# sourceMappingURL=points.controller.js.map