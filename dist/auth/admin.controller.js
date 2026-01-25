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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("./decorators/auth.decorator");
const valid_roles_interface_1 = require("./interfaces/valid.roles.interface");
const user_entity_1 = require("./entities/user.entity");
const points_service_1 = require("./services/points.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_points_entity_1 = require("./entities/user-points.entity");
const orders_service_1 = require("../orders/orders.service");
let AdminController = class AdminController {
    pointsService;
    ordersService;
    userRepo;
    pointsRepo;
    constructor(pointsService, ordersService, userRepo, pointsRepo) {
        this.pointsService = pointsService;
        this.ordersService = ordersService;
        this.userRepo = userRepo;
        this.pointsRepo = pointsRepo;
    }
    async getAllUsers() {
        const users = await this.userRepo.find({
            select: ['id', 'email', 'fullName', 'phone', 'isActive', 'roles', 'createdAt', 'provider'],
            order: { fullName: 'ASC' },
        });
        return users;
    }
    async updateUserActive(id, body) {
        const user = await this.userRepo.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.isActive = body.isActive;
        await this.userRepo.save(user);
        return {
            success: true,
            message: body.isActive ? 'Usuario activado' : 'Usuario desactivado',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                isActive: user.isActive,
            },
        };
    }
    async createPoints(req, body) {
        try {
            const { pointsCount, description } = body;
            if (!pointsCount) {
                throw new common_1.BadRequestException('pointsCount is required');
            }
            if (pointsCount < 1 || pointsCount > 100) {
                throw new common_1.BadRequestException('pointsCount must be between 1 and 100');
            }
            const pointsRecords = [];
            const pointCodes = [];
            for (let i = 0; i < pointsCount; i++) {
                const code = await this.pointsService.generateUniquePointCode();
                const pointRecord = this.pointsRepo.create({
                    code,
                    userId: null,
                    orderId: null,
                    orderDailyNumber: null,
                    isUsed: false,
                    isCanceled: false,
                    isRedeemed: false,
                    type: 'admin',
                    description: description || `Puntos generados por admin (${pointsCount} puntos)`,
                });
                const saved = await this.pointsRepo.save(pointRecord);
                pointsRecords.push(saved);
                pointCodes.push(saved.code);
            }
            return {
                success: true,
                message: `${pointsCount} punto(s) generado(s) exitosamente`,
                points: pointsRecords,
                pointCodes,
            };
        }
        catch (error) {
            console.error('Error creating points:', error);
            throw error;
        }
    }
    async getUserPoints(userId) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const totalPoints = await this.pointsService.getTotalPoints(userId);
        const availablePoints = await this.pointsService.getAvailablePoints(userId);
        const history = await this.pointsService.getPointsHistory(userId, 100);
        return {
            totalPoints,
            availablePoints,
            history,
        };
    }
    async getOrdersByDate(date) {
        if (!date) {
            throw new common_1.BadRequestException('Date parameter is required (YYYY-MM-DD)');
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            throw new common_1.BadRequestException('Invalid date format. Use YYYY-MM-DD');
        }
        const orders = await this.ordersService.findOrdersByDate(date);
        return orders;
    }
    async getDailySummary(date) {
        if (date) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                throw new common_1.BadRequestException('Invalid date format. Use YYYY-MM-DD');
            }
        }
        const summary = await this.ordersService.getDailySummary(date);
        return summary;
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Users retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Patch)('users/:id/active'),
    (0, swagger_1.ApiOperation)({ summary: 'Activate or deactivate user (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUserActive", null);
__decorate([
    (0, common_1.Post)('points/create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create points without user (admin only). For printing and manual redemption.' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Points created successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPoints", null);
__decorate([
    (0, common_1.Get)('points/user/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get points for a specific user (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User points retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUserPoints", null);
__decorate([
    (0, common_1.Get)('orders/by-date'),
    (0, swagger_1.ApiOperation)({ summary: 'Get orders by date (admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format', example: '2025-01-21' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Orders retrieved successfully' }),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getOrdersByDate", null);
__decorate([
    (0, common_1.Get)('orders/daily-summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get daily summary/cash register report (admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format. If not provided, uses today.', example: '2025-01-21' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Daily summary retrieved successfully' }),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getDailySummary", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, common_1.Controller)('admin'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(user_points_entity_1.UserPoints)),
    __metadata("design:paramtypes", [points_service_1.PointsService,
        orders_service_1.OrdersService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminController);
//# sourceMappingURL=admin.controller.js.map