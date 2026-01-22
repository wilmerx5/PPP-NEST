import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Auth } from './decorators/auth.decorator';
import { ValidRoles } from './interfaces/valid.roles.interface';
import { User } from './entities/user.entity';
import { Request } from 'express';
import { PointsService } from './services/points.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoints } from './entities/user-points.entity';

@ApiTags('Admin')
@Controller('admin')
@Auth(ValidRoles.admin)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly pointsService: PointsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserPoints)
    private readonly pointsRepo: Repository<UserPoints>,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(@Req() req: Request) {
    const users = await this.userRepo.find({
      select: ['id', 'email', 'fullName', 'phone'],
      order: { fullName: 'ASC' },
    });

    return users;
  }

  @Post('points/create')
  @ApiOperation({ summary: 'Create points without user (admin only). For printing and manual redemption.' })
  @ApiResponse({ status: 201, description: 'Points created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createPoints(
    @Req() req: Request,
    @Body() body: { pointsCount: number; description?: string },
  ) {
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
}
