import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { UserPoints } from '../entities/user-points.entity';
import { PointRedemption } from '../entities/point-redemption.entity';
import { User } from '../entities/user.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Product codes that generate points individually: 1, 99, 4, 98, 89
 * Codes 2 and 5 only generate a point when BOTH are present together
 */
const INDIVIDUAL_POINTS_CODES = [1, 99, 4, 98, 89];
const PAIR_CODES = [2, 5]; // These only generate a point when both are together

/**
 * Generates a secure alphanumeric code of 12 characters.
 * Uses uppercase letters and numbers, excluding confusing characters (0, O, I, L).
 */
function generatePointCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, L, 1
  let code = '';
  
  // Use crypto.randomBytes for cryptographically secure random numbers
  const randomBytes = crypto.randomBytes(12);
  
  for (let i = 0; i < 12; i++) {
    const randomIndex = randomBytes[i] % chars.length;
    code += chars[randomIndex];
  }
  
  return code;
}

@Injectable()
export class PointsService {
  private readonly REDEMPTION_POINTS_REQUIRED = 9;
  
  constructor(
    @InjectRepository(UserPoints)
    private readonly pointsRepo: Repository<UserPoints>,
    @InjectRepository(PointRedemption)
    private readonly redemptionRepo: Repository<PointRedemption>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculates points for an order based on product codes.
   * Rules:
   * - Codes 1, 99, 4, 98, 89: each generates 1 point
   * - Codes 2 and 5: generate 1 point ONLY when both are present together
   * 
   * @param items - Array of order items with productId and quantity
   * @returns Total points calculated
   */
  async calculatePointsForOrder(
    items: Array<{ productId: number; quantity: number }>
  ): Promise<number> {
    if (!items || items.length === 0) {
      return 0;
    }

    // Get all product codes
    const codes: number[] = [];
    for (const item of items) {
      const product = await this.productRepo.findOne({
        where: { id: item.productId },
        select: ['code'],
      });
      if (product) {
        // Add the code as many times as the quantity
        for (let i = 0; i < (item.quantity || 1); i++) {
          codes.push(product.code);
        }
      }
    }

    return this.calculatePointsFromCodes(codes);
  }

  /**
   * Calculates points for an order using product codes directly (more efficient).
   * Rules:
   * - Codes 1, 99, 4, 98, 89: each generates 1 point
   * - Codes 2 and 5: generate 1 point ONLY when both are present together
   * 
   * @param codes - Array of product codes (not grouped, includes duplicates for quantity)
   * @returns Total points calculated
   */
  calculatePointsFromCodes(codes: number[]): number {
    if (!codes || codes.length === 0) {
      return 0;
    }

    let totalPoints = 0;
    
    // Count occurrences of each code
    const codeCounts: Record<number, number> = {};
    for (const code of codes) {
      codeCounts[code] = (codeCounts[code] || 0) + 1;
    }

    // Calculate points from individual codes (1, 99, 4, 98, 89)
    for (const code of INDIVIDUAL_POINTS_CODES) {
      if (codeCounts[code]) {
        totalPoints += codeCounts[code];
      }
    }

    // Calculate points from pair codes (2 and 5 together)
    const hasCode2 = (codeCounts[2] || 0) > 0;
    const hasCode5 = (codeCounts[5] || 0) > 0;
    
    if (hasCode2 && hasCode5) {
      // Calculate how many pairs we can form
      const pairsCount = Math.min(codeCounts[2], codeCounts[5]);
      totalPoints += pairsCount;
    }

    return totalPoints;
  }

  /**
   * Generates a unique point code (12-character alphanumeric).
   * Ensures the code doesn't already exist in the database.
   * 
   * @returns Unique point code
   */
  async generateUniquePointCode(): Promise<string> {
    let code: string;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to generate a unique code (should be very rare to need retries)
    while (exists && attempts < maxAttempts) {
      code = generatePointCode();
      const existing = await this.pointsRepo.findOne({ where: { code } });
      exists = !!existing;
      attempts++;
    }

    if (exists) {
      throw new BadRequestException('Failed to generate unique point code after multiple attempts');
    }

    return code!;
  }

  /**
   * Creates point codes for an online order.
   * Each point gets a unique alphanumeric code.
   * 
   * @param userId - User ID
   * @param orderId - Order ID
   * @param orderDailyNumber - Daily order number
   * @param pointsCount - Number of points to create (each gets its own code)
   * @returns Array of created UserPoints records
   */
  async createPointsForOrder(
    userId: string,
    orderId: number,
    orderDailyNumber: number,
    pointsCount: number
  ): Promise<UserPoints[]> {
    if (pointsCount <= 0) {
      return []; // No points to create
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pointsRecords: UserPoints[] = [];

    // Create one point record per point, each with its own unique code
    // For automatic points (online orders), mark them as used immediately
    // since they are automatically applied to the user's account
    for (let i = 0; i < pointsCount; i++) {
      const code = await this.generateUniquePointCode();
      
      const pointRecord = this.pointsRepo.create({
        code,
        userId,
        orderId,
        orderDailyNumber,
        isUsed: true, // Automatically marked as used for online orders
        type: 'automatic',
        description: `Punto automático de orden #${orderDailyNumber}`,
      });

      pointsRecords.push(await this.pointsRepo.save(pointRecord));
    }

    return pointsRecords;
  }

  /**
   * Registers a point manually by code (for internal orders).
   * Validates that the code exists, hasn't been used, and isn't already assigned.
   * 
   * @param userId - User ID
   * @param code - Point code from the receipt
   * @returns Created/updated UserPoints record
   */
  async registerPointByCode(
    userId: string,
    code: string
  ): Promise<UserPoints> {
    if (!code || code.length !== 12) {
      throw new BadRequestException('El código de punto debe tener exactamente 12 caracteres');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the point by code
    const point = await this.pointsRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!point) {
      throw new NotFoundException('Código de punto no encontrado. Verifica el código de tu recibo.');
    }

    // Check if already used
    if (point.isUsed) {
      throw new ConflictException('Este código de punto ya fue usado.');
    }

    // Check if already assigned to another user
    if (point.userId && point.userId !== userId) {
      throw new ConflictException('Este código ya fue registrado por otro usuario.');
    }

    // Assign to user and mark as used
    point.userId = userId;
    point.isUsed = true;
    point.type = 'manual';
    point.description = `Punto registrado manualmente (código: ${code})`;

    return await this.pointsRepo.save(point);
  }

  /**
   * Gets total accumulated points for a user.
   * This is the sum of ALL valid points earned by the user (excluding canceled ones).
   * Points accumulate over time and the total keeps increasing.
   * Canceled points are excluded from the total.
   * 
   * @param userId - User ID
   * @returns Total accumulated points (all valid points, excluding canceled)
   */
  async getTotalPoints(userId: string): Promise<number> {
    // Count ALL points for the user, excluding canceled and redeemed ones
    // This represents the total accumulated valid points available to the user
    return await this.pointsRepo.count({
      where: {
        userId,
        isCanceled: false, // Exclude canceled points from total
        isRedeemed: false, // Exclude redeemed points from total (they were used for prizes)
      },
    });
  }

  /**
   * Gets points history for a user (both used and unused, including canceled).
   * 
   * @param userId - User ID
   * @param limit - Maximum number of records to return
   * @returns Array of UserPoints records
   */
  async getPointsHistory(userId: string, limit: number = 50): Promise<UserPoints[]> {
    return await this.pointsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Gets all point codes for a specific order (for printing on receipt).
   * 
   * @param orderId - Order ID
   * @returns Array of point codes
   */
  async getPointCodesByOrderId(orderId: number): Promise<string[]> {
    const points = await this.pointsRepo.find({
      where: { orderId },
      select: ['code'],
    });

    return points.map(p => p.code);
  }

  /**
   * Updates point codes for an order when items change.
   * Regenerates codes if the number of points changed.
   * Only updates codes that haven't been used/assigned yet.
   * 
   * @param orderId - Order ID
   * @param orderDailyNumber - Daily order number
   * @param newPointsCount - New number of points calculated
   * @returns Array of all point codes for the order (both old and new)
   */
  async updatePointCodesForOrder(
    orderId: number,
    orderDailyNumber: number,
    newPointsCount: number
  ): Promise<string[]> {
    // Get existing point codes for this order
    const existingPoints = await this.pointsRepo.find({
      where: { orderId },
    });

    // Count how many are unused/unassigned (can be safely modified)
    const unusedPoints = existingPoints.filter(p => !p.isUsed && !p.userId);
    const usedPoints = existingPoints.filter(p => p.isUsed || p.userId);
    const currentCount = existingPoints.length;

    if (newPointsCount === currentCount) {
      // No change, return existing codes
      return existingPoints.map(p => p.code);
    }

    if (newPointsCount > currentCount) {
      // Need more points: generate new codes
      const pointsToAdd = newPointsCount - currentCount;
      const newCodes: UserPoints[] = [];

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

      // Return all codes (existing + new)
      return [...existingPoints.map(p => p.code), ...newCodes.map(p => p.code)];
    } else {
      // Need fewer points: delete unused ones (keep used/assigned ones)
      const pointsToRemove = currentCount - newPointsCount;
      
      if (unusedPoints.length >= pointsToRemove) {
        // Delete only unused points
        const pointsToDelete = unusedPoints.slice(0, pointsToRemove);
        await this.pointsRepo.remove(pointsToDelete);
        
        // Return remaining codes (used + remaining unused)
        const remainingPoints = existingPoints.filter(
          p => !pointsToDelete.some(d => d.id === p.id)
        );
        return remainingPoints.map(p => p.code);
      } else {
        // Not enough unused points to delete, but can't delete used ones
        // This means we have more used points than the new count
        // In this case, keep all points (don't delete used ones)
        // This is an edge case where user might have already registered some codes
        return existingPoints.map(p => p.code);
      }
    }
  }

  /**
   * Invalidates point codes for a canceled order.
   * Marks all points as canceled so they are excluded from totals and cannot be used.
   * This applies to both automatic (online) and manual (internal) points.
   * 
   * @param orderId - Order ID that was canceled
   * @returns Number of points invalidated
   */
  async invalidatePointsForCanceledOrder(orderId: number): Promise<number> {
    // Get all point codes for this order (both assigned and unassigned)
    const points = await this.pointsRepo.find({
      where: { orderId },
    });

    if (points.length === 0) {
      return 0; // No points to invalidate
    }

    // Mark all points as canceled - they will be excluded from totals
    let invalidatedCount = 0;
    for (const point of points) {
      if (!point.isCanceled) {
        point.isCanceled = true;
        point.isUsed = true; // Also mark as used to prevent further use
        
        // Update description to indicate cancellation
        const originalDesc = point.description || `Punto de orden #${point.orderDailyNumber}`;
        point.description = `[CANCELADO] ${originalDesc} - Orden cancelada`;
        
        await this.pointsRepo.save(point);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Gets available points (not canceled, not redeemed) for a user.
   * This represents points that can be used for redemption.
   * 
   * @param userId - User ID
   * @returns Number of available points
   */
  async getAvailablePoints(userId: string): Promise<number> {
    return await this.pointsRepo.count({
      where: {
        userId,
        isCanceled: false,
        isRedeemed: false,
      },
    });
  }

  /**
   * Redeems 9 points for a prize that can be used to get a free half chicken (product code 2 or 5).
   * Marks the 9 oldest available points as redeemed and creates a redemption prize.
   * 
   * @param userId - User ID
   * @returns Created redemption prize
   */
  async redeemPointsForVoucher(userId: string): Promise<PointRedemption> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get available points (not canceled, not redeemed)
    const availablePoints = await this.getAvailablePoints(userId);
    
    if (availablePoints < this.REDEMPTION_POINTS_REQUIRED) {
      throw new BadRequestException(
        `You need at least ${this.REDEMPTION_POINTS_REQUIRED} points to redeem. You currently have ${availablePoints} available points.`
      );
    }

    // Get the oldest 9 available points (FIFO - First In First Out)
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
      throw new BadRequestException('Not enough available points to redeem');
    }

    // Mark points as redeemed
    for (const point of pointsToRedeem) {
      point.isRedeemed = true;
      await this.pointsRepo.save(point);
    }

    // Generate unique redemption code
    const redemptionCode = await this.generateUniqueRedemptionCode();

    // Create expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create redemption voucher
    const redemption = this.redemptionRepo.create({
      code: redemptionCode,
      userId,
      isUsed: false,
      expiresAt,
    });

    return await this.redemptionRepo.save(redemption);
  }

  /**
   * Generates a unique redemption code (12-character alphanumeric).
   * 
   * @returns Unique redemption code
   */
  async generateUniqueRedemptionCode(): Promise<string> {
    let code: string;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
      code = generatePointCode(); // Reuse the same function as point codes
      const existing = await this.redemptionRepo.findOne({ where: { code } });
      exists = !!existing;
      attempts++;
    }

    if (exists) {
      throw new Error('No se pudo generar un código de premio único después de varios intentos');
    }

    return code!;
  }

  /**
   * Validates a redemption code and checks if it can be used.
   * 
   * @param code - Redemption code
   * @returns Redemption voucher if valid
   */
  async validateRedemptionCode(code: string): Promise<PointRedemption> {
    if (!code || code.length !== 12) {
      throw new BadRequestException('Redemption code must be exactly 12 characters');
    }

    const redemption = await this.redemptionRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!redemption) {
      throw new NotFoundException('Código de premio no encontrado');
    }

    if (redemption.isUsed) {
      throw new ConflictException('This redemption code has already been used');
    }

    if (redemption.expiresAt && redemption.expiresAt < new Date()) {
      throw new BadRequestException('This redemption code has expired');
    }

    return redemption;
  }

  /**
   * Applies a redemption prize to an order.
   * Marks the prize as used and associates it with the order.
   * 
   * @param code - Redemption code
   * @param orderId - Order ID where the prize is being applied
   * @returns Updated redemption prize
   */
  async applyRedemptionToOrder(code: string, orderId: number): Promise<PointRedemption> {
    const redemption = await this.validateRedemptionCode(code);

    redemption.isUsed = true;
    redemption.usedAt = new Date();
    redemption.usedInOrderId = orderId;

    return await this.redemptionRepo.save(redemption);
  }

  /**
   * Gets all redemption prizes for a user (both used and unused).
   * Includes order information if prize is used.
   * 
   * @param userId - User ID
   * @returns Array of redemption prizes with order info if used
   */
  async getUserRedemptions(userId: string): Promise<any[]> {
    const redemptions = await this.redemptionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Enrich with order information for used vouchers
    const enrichedRedemptions = await Promise.all(
      redemptions.map(async (redemption) => {
        const result: any = {
          ...redemption,
          orderInfo: null,
        };

        if (redemption.isUsed && redemption.usedInOrderId) {
          // Get order daily number from database
          const order = await this.dataSource.query(
            `SELECT daily_order_number, created_at, customer_name 
             FROM ppp_orders 
             WHERE id = ?`,
            [redemption.usedInOrderId]
          );

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
      })
    );

    return enrichedRedemptions;
  }

  /**
   * Gets active (unused and not expired) redemption prizes for a user.
   * 
   * @param userId - User ID
   * @returns Array of active redemption prizes
   */
  async getActiveRedemptions(userId: string): Promise<PointRedemption[]> {
    const now = new Date();
    return await this.redemptionRepo
      .createQueryBuilder('redemption')
      .where('redemption.userId = :userId', { userId })
      .andWhere('redemption.isUsed = :isUsed', { isUsed: false })
      .andWhere('(redemption.expiresAt IS NULL OR redemption.expiresAt > :now)', { now })
      .orderBy('redemption.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Gets leaderboard of users with most points.
   * Returns users ordered by total points (descending).
   * 
   * @param limit - Maximum number of users to return (default: 100)
   * @param offset - Number of users to skip (for pagination, default: 0)
   * @param search - Optional search term for user name or email
   * @returns Array of users with their point totals
   */
  async getLeaderboard(limit: number = 100, offset: number = 0, search?: string): Promise<{
    users: Array<{
      userId: string;
      fullName: string;
      email: string;
      phone: string | null;
      totalPoints: number;
      availablePoints: number;
      redeemedPoints: number;
      rank: number;
    }>;
    total: number;
  }> {
    const excludedEmail = 'wilmercampos2004@gmail.com';

    // First, get all users with their point counts (for total count and ranking)
    let baseQuery = this.pointsRepo
      .createQueryBuilder('point')
      .select('point.userId', 'userId')
      .addSelect('SUM(CASE WHEN point.isCanceled = false THEN 1 ELSE 0 END)', 'totalPoints')
      .addSelect('SUM(CASE WHEN point.isCanceled = false AND point.isRedeemed = false THEN 1 ELSE 0 END)', 'availablePoints')
      .addSelect('SUM(CASE WHEN point.isRedeemed = true THEN 1 ELSE 0 END)', 'redeemedPoints')
      .where('point.userId IS NOT NULL')
      .groupBy('point.userId');

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      baseQuery = baseQuery
        .innerJoin('ppp_users', 'user', 'user.id = point.userId')
        .andWhere('(user.fullName LIKE :search OR user.email LIKE :search)', { search: searchTerm })
        .andWhere('user.email != :excludedEmail', { excludedEmail });
    } else {
      baseQuery = baseQuery
        .innerJoin('ppp_users', 'user', 'user.id = point.userId')
        .andWhere('user.email != :excludedEmail', { excludedEmail });
    }

    // Get total count efficiently using COUNT instead of loading all records
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

    // Order by total points descending
    baseQuery = baseQuery.orderBy('totalPoints', 'DESC').addOrderBy('point.userId', 'ASC');

    // Apply pagination
    baseQuery = baseQuery.limit(limit).offset(offset);

    // Add user details to select
    baseQuery = baseQuery
      .addSelect('user.fullName', 'fullName')
      .addSelect('user.email', 'email')
      .addSelect('user.phone', 'phone');

    const results = await baseQuery.getRawMany();

    // Map results and calculate ranks
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
}
