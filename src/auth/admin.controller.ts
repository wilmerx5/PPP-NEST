import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Auth } from './decorators/auth.decorator';
import { ValidRoles } from './interfaces/valid.roles.interface';
import { User } from './entities/user.entity';
import { Request } from 'express';
import { PointsService } from './services/points.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoints } from './entities/user-points.entity';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';

@ApiTags('Admin')
@Controller('admin')
@Auth(ValidRoles.admin)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserPoints)
    private readonly pointsRepo: Repository<UserPoints>,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination and search (admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 15 })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email or phone' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
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
      qb.andWhere(
        '(user.fullName ILike :q OR user.email ILike :q OR user.phone ILike :q)',
        { q: `%${searchTrim}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total };
  }

  @Patch('users/:id/active')
  @ApiOperation({ summary: 'Activate or deactivate user (admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
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

  @Post('points/create')
  @ApiOperation({ summary: 'Create points without user (admin only). For printing and manual redemption.' })
  @ApiResponse({ status: 201, description: 'Points created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createPoints(
    @Req() req: Request,
    @Body() body: { pointsCount: number; description?: string },
  ) {
    try {
      const { pointsCount, description } = body;

      if (!pointsCount) {
        throw new BadRequestException('pointsCount is required');
      }

      if (pointsCount < 1 || pointsCount > 100) {
        throw new BadRequestException('pointsCount must be between 1 and 100');
      }

      const pointsRecords: UserPoints[] = [];
      const pointCodes: string[] = [];

      for (let i = 0; i < pointsCount; i++) {
        const code = await this.pointsService.generateUniquePointCode();

        const pointRecord = this.pointsRepo.create({
          code,
          userId: null, // Sin asignar; el cliente los registra después
          orderId: null,
          orderDailyNumber: null,
          isUsed: false, // Disponibles para registro manual
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
    } catch (error) {
      // Log the error for debugging
      console.error('Error creating points:', error);
      throw error;
    }
  }

  @Get('points/user/:userId')
  @ApiOperation({ summary: 'Get points for a specific user (admin only)' })
  @ApiResponse({ status: 200, description: 'User points retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserPoints(@Param('userId') userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
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

  @Get('orders/by-date')
  @ApiOperation({ summary: 'Get orders by date (admin only)' })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format', example: '2025-01-21' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getOrdersByDate(@Query('date') date: string) {
    if (!date) {
      throw new BadRequestException('Date parameter is required (YYYY-MM-DD)');
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const orders = await this.ordersService.findOrdersByDate(date);
    return orders;
  }

  @Get('orders/daily-summary')
  @ApiOperation({ summary: 'Get daily summary/cash register report (admin only)' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format. If not provided, uses today.', example: '2025-01-21' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved successfully' })
  async getDailySummary(@Query('date') date?: string) {
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
    }

    const summary = await this.ordersService.getDailySummary(date);
    return summary;
  }

  @Get('reports/sales')
  @ApiOperation({ summary: 'Get sales report between dates (admin only)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'End date YYYY-MM-DD' })
  @ApiQuery({ name: 'period', required: false, description: 'Preset: 7d (last 7 days), 30d (last 30 days)' })
  @ApiResponse({ status: 200, description: 'Sales report retrieved successfully' })
  async getSalesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('period') period?: string,
  ) {
    const { addDays } = await import('date-fns');
    const { formatInTimeZone } = await import('date-fns-tz');
    const now = new Date();
    const todayBogota = formatInTimeZone(now, 'America/Bogota', 'yyyy-MM-dd');
    let fromStr: string;
    let toStr: string;

    if (period === '7d') {
      toStr = todayBogota;
      fromStr = formatInTimeZone(addDays(now, -6), 'America/Bogota', 'yyyy-MM-dd');
    } else if (period === '30d') {
      toStr = todayBogota;
      fromStr = formatInTimeZone(addDays(now, -29), 'America/Bogota', 'yyyy-MM-dd');
    } else if (from && to) {
      fromStr = from;
      toStr = to;
    } else {
      throw new BadRequestException('Provide either period=7d|30d or from+to (YYYY-MM-DD)');
    }

    return this.ordersService.getSalesReport(fromStr, toStr);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products including inactive (admin only)' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async getAllProducts() {
    return this.productsService.findAllForAdmin();
  }

  @Patch('products/:id/active')
  @ApiOperation({ summary: 'Activate or deactivate product (admin only)' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProductActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.productsService.updateActive(+id, body.isActive);
  }

  @Get('points/leaderboard')
  @ApiOperation({ summary: 'Get points leaderboard (admin only)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of users to return', example: 50 })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of users to skip (for pagination)', example: 0 })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for user name or email' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    if (limitNum < 1 || limitNum > 500) {
      throw new BadRequestException('Limit must be between 1 and 500');
    }

    if (offsetNum < 0) {
      throw new BadRequestException('Offset must be >= 0');
    }

    return await this.pointsService.getLeaderboard(limitNum, offsetNum, search);
  }
}
