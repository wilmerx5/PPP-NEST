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

@ApiTags('Admin')
@Controller('admin')
@Auth(ValidRoles.admin)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly ordersService: OrdersService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserPoints)
    private readonly pointsRepo: Repository<UserPoints>,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers() {
    const users = await this.userRepo.find({
      select: ['id', 'email', 'fullName', 'phone', 'isActive', 'roles', 'createdAt', 'provider'],
      order: { fullName: 'ASC' },
    });

    return users;
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
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
    }

    const summary = await this.ordersService.getDailySummary(date);
    return summary;
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
