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
const products_service_1 = require("../products/products.service");
let AdminController = class AdminController {
    pointsService;
    ordersService;
    productsService;
    userRepo;
    pointsRepo;
    constructor(pointsService, ordersService, productsService, userRepo, pointsRepo) {
        this.pointsService = pointsService;
        this.ordersService = ordersService;
        this.productsService = productsService;
        this.userRepo = userRepo;
        this.pointsRepo = pointsRepo;
    }
    async getAllUsers(page, limit, search) {
        const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : 1;
        const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 15)) : 15;
        const searchTrim = search?.trim();
        const qb = this.userRepo
            .createQueryBuilder('user')
            .select([
            'user.id',
            'user.email',
            'user.fullName',
            'user.phone',
            'user.isActive',
            'user.roles',
            'user.createdAt',
            'user.provider',
        ])
            .orderBy('user.fullName', 'ASC')
            .skip((pageNum - 1) * limitNum)
            .take(limitNum);
        if (searchTrim) {
            qb.andWhere('(user.fullName ILike :q OR user.email ILike :q OR user.phone ILike :q)', { q: `%${searchTrim}%` });
        }
        const [data, total] = await qb.getManyAndCount();
        return { data, total };
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
    async getSalesReport(from, to, period) {
        const { addDays } = await Promise.resolve().then(() => require('date-fns'));
        const { formatInTimeZone } = await Promise.resolve().then(() => require('date-fns-tz'));
        const now = new Date();
        const todayBogota = formatInTimeZone(now, 'America/Bogota', 'yyyy-MM-dd');
        let fromStr;
        let toStr;
        if (period === '7d') {
            toStr = todayBogota;
            fromStr = formatInTimeZone(addDays(now, -6), 'America/Bogota', 'yyyy-MM-dd');
        }
        else if (period === '30d') {
            toStr = todayBogota;
            fromStr = formatInTimeZone(addDays(now, -29), 'America/Bogota', 'yyyy-MM-dd');
        }
        else if (from && to) {
            fromStr = from;
            toStr = to;
        }
        else {
            throw new common_1.BadRequestException('Provide either period=7d|30d or from+to (YYYY-MM-DD)');
        }
        return this.ordersService.getSalesReport(fromStr, toStr);
    }
    async getAllProducts() {
        return this.productsService.findAllForAdmin();
    }
    async updateProductActive(id, body) {
        return this.productsService.updateActive(+id, body.isActive);
    }
    async getLeaderboard(limit, offset, search) {
        const limitNum = limit ? parseInt(limit, 10) : 100;
        const offsetNum = offset ? parseInt(offset, 10) : 0;
        if (limitNum < 1 || limitNum > 500) {
            throw new common_1.BadRequestException('Limit must be between 1 and 500');
        }
        if (offsetNum < 0) {
            throw new common_1.BadRequestException('Offset must be >= 0');
        }
        return await this.pointsService.getLeaderboard(limitNum, offsetNum, search);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users with pagination and search (admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Items per page', example: 15 }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: 'Search by name, email or phone' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Users retrieved successfully' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
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
__decorate([
    (0, common_1.Get)('reports/sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Get sales report between dates (admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false, description: 'Start date YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false, description: 'End date YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'period', required: false, description: 'Preset: 7d (last 7 days), 30d (last 30 days)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sales report retrieved successfully' }),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSalesReport", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all products including inactive (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Products retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getAllProducts", null);
__decorate([
    (0, common_1.Patch)('products/:id/active'),
    (0, swagger_1.ApiOperation)({ summary: 'Activate or deactivate product (admin only)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Product updated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateProductActive", null);
__decorate([
    (0, common_1.Get)('points/leaderboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Get points leaderboard (admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Number of users to return', example: 50 }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, description: 'Number of users to skip (for pagination)', example: 0 }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: 'Search term for user name or email' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Leaderboard retrieved successfully' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getLeaderboard", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, common_1.Controller)('admin'),
    (0, auth_decorator_1.Auth)(valid_roles_interface_1.ValidRoles.admin),
    (0, swagger_1.ApiBearerAuth)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_1.InjectRepository)(user_points_entity_1.UserPoints)),
    __metadata("design:paramtypes", [points_service_1.PointsService,
        orders_service_1.OrdersService,
        products_service_1.ProductsService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminController);
//# sourceMappingURL=admin.controller.js.map