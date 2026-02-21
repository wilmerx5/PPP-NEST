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
const typeorm_1 = require("typeorm");
const auth_decorator_1 = require("./decorators/auth.decorator");
const valid_roles_interface_1 = require("./interfaces/valid.roles.interface");
const user_entity_1 = require("./entities/user.entity");
const points_service_1 = require("./services/points.service");
const typeorm_2 = require("@nestjs/typeorm");
const typeorm_3 = require("typeorm");
const user_points_entity_1 = require("./entities/user-points.entity");
const orders_service_1 = require("../orders/orders.service");
const products_service_1 = require("../products/products.service");
const date_util_1 = require("../common/utils/date.util");
const date_fns_tz_1 = require("date-fns-tz");
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
            qb.andWhere('(user.fullName LIKE :q OR user.email LIKE :q OR user.phone LIKE :q)', { q: `%${searchTrim}%` });
        }
        const [data, total] = await qb.getManyAndCount();
        return { data, total };
    }
    async updateUserActive(id, body) {
        const user = await this.userRepo.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
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
                throw new common_1.BadRequestException('La cantidad de puntos es obligatoria');
            }
            if (pointsCount < 1 || pointsCount > 100) {
                throw new common_1.BadRequestException('La cantidad de puntos debe estar entre 1 y 100');
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
            throw new common_1.BadRequestException('Usuario no encontrado');
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
            throw new common_1.BadRequestException('El parámetro fecha es obligatorio (formato YYYY-MM-DD)');
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
        }
        const orders = await this.ordersService.findOrdersByDate(date);
        return orders;
    }
    async getDailySummary(date) {
        if (date) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
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
            throw new common_1.BadRequestException('Indica periodo=7d|30d o las fechas from y to (YYYY-MM-DD)');
        }
        return this.ordersService.getSalesReport(fromStr, toStr);
    }
    async getAllProducts() {
        return this.productsService.findAllForAdmin();
    }
    async updateProductActive(id, body) {
        return this.productsService.updateActive(+id, body.isActive);
    }
    async getPointsSummary(date, from, to, allTime) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        let qb = this.pointsRepo.createQueryBuilder('p').select('p');
        if (allTime === '1' || allTime === 'true') {
        }
        else if (date && dateRegex.test(date)) {
            const range = (0, date_util_1.getBogotaDateRange)(date);
            qb = qb.where('p.createdAt >= :start', { start: range.start }).andWhere('p.createdAt <= :end', { end: range.end });
        }
        else if (from && to && dateRegex.test(from) && dateRegex.test(to)) {
            const startRange = (0, date_util_1.getBogotaDateRange)(from);
            const endRange = (0, date_util_1.getBogotaDateRange)(to);
            if (startRange.start > endRange.end)
                throw new common_1.BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
            qb = qb.where('p.createdAt >= :start', { start: startRange.start }).andWhere('p.createdAt <= :end', { end: endRange.end });
        }
        else {
            throw new common_1.BadRequestException('Indica date=YYYY-MM-DD, from y to, o allTime=1');
        }
        const points = await qb.getMany();
        const total = points.length;
        const used = points.filter((p) => p.isUsed).length;
        const unused = total - used;
        return { total, used, unused };
    }
    async getPointsRecords(date, from, to) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        let startUtc;
        let endUtc;
        if (date) {
            if (!dateRegex.test(date))
                throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
            const range = (0, date_util_1.getBogotaDateRange)(date);
            startUtc = range.start;
            endUtc = range.end;
        }
        else if (from && to) {
            if (!dateRegex.test(from) || !dateRegex.test(to))
                throw new common_1.BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
            const startRange = (0, date_util_1.getBogotaDateRange)(from);
            const endRange = (0, date_util_1.getBogotaDateRange)(to);
            startUtc = startRange.start;
            endUtc = endRange.end;
            if (startUtc > endUtc)
                throw new common_1.BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
        }
        else {
            throw new common_1.BadRequestException('Indica date=YYYY-MM-DD o from y to (YYYY-MM-DD)');
        }
        const points = await this.pointsRepo.find({
            where: { createdAt: (0, typeorm_1.Between)(startUtc, endUtc) },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
        const orderIds = points.map((p) => p.orderId).filter((id) => id != null);
        const ordersBrief = orderIds.length ? await this.ordersService.getOrdersBrief(orderIds) : [];
        const orderMap = new Map(ordersBrief.map((o) => [o.id, o]));
        const records = points.map((p) => {
            const order = p.orderId ? orderMap.get(p.orderId) : null;
            return {
                id: p.id,
                code: p.code,
                userId: p.userId,
                user: p.user ? { id: p.user.id, fullName: p.user.fullName, email: p.user.email } : null,
                orderId: p.orderId,
                orderDailyNumber: p.orderDailyNumber,
                orderCreatedAt: order?.createdAt ? (0, date_fns_tz_1.formatInTimeZone)(order.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm") : null,
                type: p.type,
                isUsed: p.isUsed,
                isCanceled: p.isCanceled,
                isRedeemed: p.isRedeemed,
                description: p.description,
                createdAt: (0, date_fns_tz_1.formatInTimeZone)(p.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss"),
            };
        });
        return { records, total: records.length };
    }
    async searchPointByCode(code) {
        const trimmed = code?.trim();
        if (!trimmed || trimmed.length < 2) {
            throw new common_1.BadRequestException('El código debe tener al menos 2 caracteres');
        }
        const points = await this.pointsRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.user', 'user')
            .where('p.code LIKE :code', { code: `%${trimmed}%` })
            .orderBy('p.createdAt', 'DESC')
            .getMany();
        const orderIds = points.map((p) => p.orderId).filter((id) => id != null);
        const ordersBrief = orderIds.length ? await this.ordersService.getOrdersBrief(orderIds) : [];
        const orderMap = new Map(ordersBrief.map((o) => [o.id, o]));
        const records = points.map((p) => {
            const order = p.orderId ? orderMap.get(p.orderId) : null;
            return {
                id: p.id,
                code: p.code,
                userId: p.userId,
                user: p.user ? { id: p.user.id, fullName: p.user.fullName, email: p.user.email } : null,
                orderId: p.orderId,
                orderDailyNumber: p.orderDailyNumber,
                orderCreatedAt: order?.createdAt ? (0, date_fns_tz_1.formatInTimeZone)(order.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm") : null,
                type: p.type,
                isUsed: p.isUsed,
                isCanceled: p.isCanceled,
                isRedeemed: p.isRedeemed,
                description: p.description,
                createdAt: (0, date_fns_tz_1.formatInTimeZone)(p.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss"),
            };
        });
        return { records };
    }
    async invalidatePoint(id) {
        const point = await this.pointsRepo.findOne({ where: { id: parseInt(id, 10) } });
        if (!point)
            throw new common_1.NotFoundException('Punto no encontrado');
        point.isCanceled = true;
        await this.pointsRepo.save(point);
        return { success: true, message: 'Punto invalidado', point: { id: point.id, code: point.code, isCanceled: true } };
    }
    async getLeaderboard(limit, offset, search) {
        const limitNum = limit ? parseInt(limit, 10) : 100;
        const offsetNum = offset ? parseInt(offset, 10) : 0;
        if (limitNum < 1 || limitNum > 500) {
            throw new common_1.BadRequestException('El límite debe estar entre 1 y 500');
        }
        if (offsetNum < 0) {
            throw new common_1.BadRequestException('El desplazamiento debe ser mayor o igual a 0');
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
    (0, common_1.Get)('points/records/summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Points summary: total, used, unused. By date/period or allTime=1 (admin only).' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'allTime', required: false, description: '1 = all time' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Summary counts' }),
    __param(0, (0, common_1.Query)('date')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('allTime')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPointsSummary", null);
__decorate([
    (0, common_1.Get)('points/records'),
    (0, swagger_1.ApiOperation)({ summary: 'List points records by date or period (admin only). Includes associated order.' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false, description: 'Single day YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false, description: 'Start date YYYY-MM-DD (use with to)' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false, description: 'End date YYYY-MM-DD (use with from)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Points records with order info' }),
    __param(0, (0, common_1.Query)('date')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPointsRecords", null);
__decorate([
    (0, common_1.Get)('points/records/search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search point by code in all records (admin only). No date filter.' }),
    (0, swagger_1.ApiQuery)({ name: 'code', required: true, description: 'Point code (exact or partial)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Matching points with full details' }),
    __param(0, (0, common_1.Query)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "searchPointByCode", null);
__decorate([
    (0, common_1.Patch)('points/records/:id/invalidate'),
    (0, swagger_1.ApiOperation)({ summary: 'Invalidate a point (admin only). Point will no longer be valid (e.g. like when order is canceled).' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Point invalidated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Point not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "invalidatePoint", null);
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
    __param(3, (0, typeorm_2.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_2.InjectRepository)(user_points_entity_1.UserPoints)),
    __metadata("design:paramtypes", [points_service_1.PointsService,
        orders_service_1.OrdersService,
        products_service_1.ProductsService,
        typeorm_3.Repository,
        typeorm_3.Repository])
], AdminController);
//# sourceMappingURL=admin.controller.js.map