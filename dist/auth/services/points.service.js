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
exports.PointsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto = require("crypto");
const user_points_entity_1 = require("../entities/user-points.entity");
const point_redemption_entity_1 = require("../entities/point-redemption.entity");
const user_entity_1 = require("../entities/user.entity");
const product_entity_1 = require("../../products/entities/product.entity");
const INDIVIDUAL_POINTS_CODES = [1, 99, 4, 98, 89];
const PAIR_CODES = [2, 5];
function generatePointCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
        const randomIndex = randomBytes[i] % chars.length;
        code += chars[randomIndex];
    }
    return code;
}
let PointsService = class PointsService {
    pointsRepo;
    redemptionRepo;
    userRepo;
    productRepo;
    dataSource;
    REDEMPTION_POINTS_REQUIRED = 9;
    constructor(pointsRepo, redemptionRepo, userRepo, productRepo, dataSource) {
        this.pointsRepo = pointsRepo;
        this.redemptionRepo = redemptionRepo;
        this.userRepo = userRepo;
        this.productRepo = productRepo;
        this.dataSource = dataSource;
    }
    async calculatePointsForOrder(items) {
        if (!items || items.length === 0) {
            return 0;
        }
        const codes = [];
        for (const item of items) {
            const product = await this.productRepo.findOne({
                where: { id: item.productId },
                select: ['code'],
            });
            if (product) {
                for (let i = 0; i < (item.quantity || 1); i++) {
                    codes.push(product.code);
                }
            }
        }
        return this.calculatePointsFromCodes(codes);
    }
    calculatePointsFromCodes(codes) {
        if (!codes || codes.length === 0) {
            return 0;
        }
        let totalPoints = 0;
        const codeCounts = {};
        for (const code of codes) {
            codeCounts[code] = (codeCounts[code] || 0) + 1;
        }
        for (const code of INDIVIDUAL_POINTS_CODES) {
            if (codeCounts[code]) {
                totalPoints += codeCounts[code];
            }
        }
        const hasCode2 = (codeCounts[2] || 0) > 0;
        const hasCode5 = (codeCounts[5] || 0) > 0;
        if (hasCode2 && hasCode5) {
            const pairsCount = Math.min(codeCounts[2], codeCounts[5]);
            totalPoints += pairsCount;
        }
        return totalPoints;
    }
    async generateUniquePointCode() {
        let code;
        let exists = true;
        let attempts = 0;
        const maxAttempts = 10;
        while (exists && attempts < maxAttempts) {
            code = generatePointCode();
            const existing = await this.pointsRepo.findOne({ where: { code } });
            exists = !!existing;
            attempts++;
        }
        if (exists) {
            throw new common_1.BadRequestException('Failed to generate unique point code after multiple attempts');
        }
        return code;
    }
    async createPointsForOrder(userId, orderId, orderDailyNumber, pointsCount) {
        if (pointsCount <= 0) {
            return [];
        }
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const pointsRecords = [];
        for (let i = 0; i < pointsCount; i++) {
            const code = await this.generateUniquePointCode();
            const pointRecord = this.pointsRepo.create({
                code,
                userId,
                orderId,
                orderDailyNumber,
                isUsed: true,
                type: 'automatic',
                description: `Punto automático de orden #${orderDailyNumber}`,
            });
            pointsRecords.push(await this.pointsRepo.save(pointRecord));
        }
        return pointsRecords;
    }
    async registerPointByCode(userId, code) {
        if (!code || code.length !== 12) {
            throw new common_1.BadRequestException('El código de punto debe tener exactamente 12 caracteres');
        }
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const point = await this.pointsRepo.findOne({
            where: { code: code.toUpperCase() },
        });
        if (!point) {
            throw new common_1.NotFoundException('Código de punto no encontrado. Verifica el código de tu recibo.');
        }
        if (point.isUsed) {
            throw new common_1.ConflictException('Este código de punto ya fue usado.');
        }
        if (point.userId && point.userId !== userId) {
            throw new common_1.ConflictException('Este código ya fue registrado por otro usuario.');
        }
        point.userId = userId;
        point.isUsed = true;
        point.type = 'manual';
        point.description = `Punto registrado manualmente (código: ${code})`;
        return await this.pointsRepo.save(point);
    }
    async getTotalPoints(userId) {
        return await this.pointsRepo.count({
            where: {
                userId,
                isCanceled: false,
                isRedeemed: false,
            },
        });
    }
    async getPointsHistory(userId, limit = 50) {
        return await this.pointsRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
    async getPointCodesByOrderId(orderId) {
        const points = await this.pointsRepo.find({
            where: { orderId },
            select: ['code'],
        });
        return points.map(p => p.code);
    }
    async updatePointCodesForOrder(orderId, orderDailyNumber, newPointsCount) {
        const existingPoints = await this.pointsRepo.find({
            where: { orderId },
        });
        const unusedPoints = existingPoints.filter(p => !p.isUsed && !p.userId);
        const usedPoints = existingPoints.filter(p => p.isUsed || p.userId);
        const currentCount = existingPoints.length;
        if (newPointsCount === currentCount) {
            return existingPoints.map(p => p.code);
        }
        if (newPointsCount > currentCount) {
            const pointsToAdd = newPointsCount - currentCount;
            const newCodes = [];
            for (let i = 0; i < pointsToAdd; i++) {
                const code = await this.generateUniquePointCode();
                const pointRecord = this.pointsRepo.create({
                    code,
                    userId: null,
                    orderId,
                    orderDailyNumber,
                    isUsed: false,
                    type: 'automatic',
                    description: `Punto de orden #${orderDailyNumber}`,
                });
                newCodes.push(await this.pointsRepo.save(pointRecord));
            }
            return [...existingPoints.map(p => p.code), ...newCodes.map(p => p.code)];
        }
        else {
            const pointsToRemove = currentCount - newPointsCount;
            if (unusedPoints.length >= pointsToRemove) {
                const pointsToDelete = unusedPoints.slice(0, pointsToRemove);
                await this.pointsRepo.remove(pointsToDelete);
                const remainingPoints = existingPoints.filter(p => !pointsToDelete.some(d => d.id === p.id));
                return remainingPoints.map(p => p.code);
            }
            else {
                return existingPoints.map(p => p.code);
            }
        }
    }
    async invalidatePointsForCanceledOrder(orderId) {
        const points = await this.pointsRepo.find({
            where: { orderId },
        });
        if (points.length === 0) {
            return 0;
        }
        let invalidatedCount = 0;
        for (const point of points) {
            if (!point.isCanceled) {
                point.isCanceled = true;
                point.isUsed = true;
                const originalDesc = point.description || `Punto de orden #${point.orderDailyNumber}`;
                point.description = `[CANCELADO] ${originalDesc} - Orden cancelada`;
                await this.pointsRepo.save(point);
                invalidatedCount++;
            }
        }
        return invalidatedCount;
    }
    async getAvailablePoints(userId) {
        return await this.pointsRepo.count({
            where: {
                userId,
                isCanceled: false,
                isRedeemed: false,
            },
        });
    }
    async redeemPointsForVoucher(userId) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const availablePoints = await this.getAvailablePoints(userId);
        if (availablePoints < this.REDEMPTION_POINTS_REQUIRED) {
            throw new common_1.BadRequestException(`You need at least ${this.REDEMPTION_POINTS_REQUIRED} points to redeem. You currently have ${availablePoints} available points.`);
        }
        const pointsToRedeem = await this.pointsRepo.find({
            where: {
                userId,
                isCanceled: false,
                isRedeemed: false,
            },
            order: { createdAt: 'ASC' },
            take: this.REDEMPTION_POINTS_REQUIRED,
        });
        if (pointsToRedeem.length < this.REDEMPTION_POINTS_REQUIRED) {
            throw new common_1.BadRequestException('Not enough available points to redeem');
        }
        for (const point of pointsToRedeem) {
            point.isRedeemed = true;
            await this.pointsRepo.save(point);
        }
        const redemptionCode = await this.generateUniqueRedemptionCode();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const redemption = this.redemptionRepo.create({
            code: redemptionCode,
            userId,
            isUsed: false,
            expiresAt,
        });
        return await this.redemptionRepo.save(redemption);
    }
    async generateUniqueRedemptionCode() {
        let code;
        let exists = true;
        let attempts = 0;
        const maxAttempts = 10;
        while (exists && attempts < maxAttempts) {
            code = generatePointCode();
            const existing = await this.redemptionRepo.findOne({ where: { code } });
            exists = !!existing;
            attempts++;
        }
        if (exists) {
            throw new Error('No se pudo generar un código de premio único después de varios intentos');
        }
        return code;
    }
    async validateRedemptionCode(code) {
        if (!code || code.length !== 12) {
            throw new common_1.BadRequestException('Redemption code must be exactly 12 characters');
        }
        const redemption = await this.redemptionRepo.findOne({
            where: { code: code.toUpperCase() },
        });
        if (!redemption) {
            throw new common_1.NotFoundException('Código de premio no encontrado');
        }
        if (redemption.isUsed) {
            throw new common_1.ConflictException('This redemption code has already been used');
        }
        if (redemption.expiresAt && redemption.expiresAt < new Date()) {
            throw new common_1.BadRequestException('This redemption code has expired');
        }
        return redemption;
    }
    async applyRedemptionToOrder(code, orderId) {
        const redemption = await this.validateRedemptionCode(code);
        redemption.isUsed = true;
        redemption.usedAt = new Date();
        redemption.usedInOrderId = orderId;
        return await this.redemptionRepo.save(redemption);
    }
    async getUserRedemptions(userId) {
        const redemptions = await this.redemptionRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
        const enrichedRedemptions = await Promise.all(redemptions.map(async (redemption) => {
            const result = {
                ...redemption,
                orderInfo: null,
            };
            if (redemption.isUsed && redemption.usedInOrderId) {
                const order = await this.dataSource.query(`SELECT daily_order_number, created_at, customer_name 
             FROM ppp_orders 
             WHERE id = ?`, [redemption.usedInOrderId]);
                if (order && order.length > 0) {
                    result.orderInfo = {
                        orderId: redemption.usedInOrderId,
                        dailyOrderNumber: order[0].daily_order_number,
                        createdAt: order[0].created_at,
                        customerName: order[0].customer_name,
                    };
                }
            }
            return result;
        }));
        return enrichedRedemptions;
    }
    async getActiveRedemptions(userId) {
        const now = new Date();
        return await this.redemptionRepo
            .createQueryBuilder('redemption')
            .where('redemption.userId = :userId', { userId })
            .andWhere('redemption.isUsed = :isUsed', { isUsed: false })
            .andWhere('(redemption.expiresAt IS NULL OR redemption.expiresAt > :now)', { now })
            .orderBy('redemption.createdAt', 'DESC')
            .getMany();
    }
    async getLeaderboard(limit = 100, offset = 0, search) {
        const excludedEmail = 'wilmercampos2004@gmail.com';
        let baseQuery = this.pointsRepo
            .createQueryBuilder('point')
            .select('point.userId', 'userId')
            .addSelect('SUM(CASE WHEN point.isCanceled = false THEN 1 ELSE 0 END)', 'totalPoints')
            .addSelect('SUM(CASE WHEN point.isCanceled = false AND point.isRedeemed = false THEN 1 ELSE 0 END)', 'availablePoints')
            .addSelect('SUM(CASE WHEN point.isRedeemed = true THEN 1 ELSE 0 END)', 'redeemedPoints')
            .where('point.userId IS NOT NULL')
            .groupBy('point.userId');
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            baseQuery = baseQuery
                .innerJoin('ppp_users', 'user', 'user.id = point.userId')
                .andWhere('(user.fullName LIKE :search OR user.email LIKE :search)', { search: searchTerm })
                .andWhere('user.email != :excludedEmail', { excludedEmail });
        }
        else {
            baseQuery = baseQuery
                .innerJoin('ppp_users', 'user', 'user.id = point.userId')
                .andWhere('user.email != :excludedEmail', { excludedEmail });
        }
        const countQuery = this.pointsRepo
            .createQueryBuilder('point')
            .select('COUNT(DISTINCT point.userId)', 'total')
            .innerJoin('ppp_users', 'user', 'user.id = point.userId')
            .where('point.userId IS NOT NULL')
            .andWhere('user.email != :excludedEmail', { excludedEmail });
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            countQuery.andWhere('(user.fullName LIKE :search OR user.email LIKE :search)', { search: searchTerm });
        }
        const countResult = await countQuery.getRawOne();
        const total = parseInt(countResult?.total || '0', 10);
        baseQuery = baseQuery.orderBy('totalPoints', 'DESC').addOrderBy('point.userId', 'ASC');
        baseQuery = baseQuery.limit(limit).offset(offset);
        baseQuery = baseQuery
            .addSelect('user.fullName', 'fullName')
            .addSelect('user.email', 'email')
            .addSelect('user.phone', 'phone');
        const results = await baseQuery.getRawMany();
        const users = results.map((row, index) => ({
            userId: row.userId,
            fullName: row.fullName || 'Usuario sin nombre',
            email: row.email || '',
            phone: row.phone || null,
            totalPoints: parseInt(row.totalPoints) || 0,
            availablePoints: parseInt(row.availablePoints) || 0,
            redeemedPoints: parseInt(row.redeemedPoints) || 0,
            rank: offset + index + 1,
        }));
        return { users, total };
    }
};
exports.PointsService = PointsService;
exports.PointsService = PointsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_points_entity_1.UserPoints)),
    __param(1, (0, typeorm_1.InjectRepository)(point_redemption_entity_1.PointRedemption)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], PointsService);
//# sourceMappingURL=points.service.js.map