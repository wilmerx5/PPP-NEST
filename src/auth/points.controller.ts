import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './services/points.service';
import { Auth } from './decorators/auth.decorator';
import { User } from './entities/user.entity';
import { Request } from 'express';

@ApiTags('User Points')
@Controller('auth/points')
@Auth()
@ApiBearerAuth()
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get()
  @ApiOperation({ summary: 'Get total points for authenticated user' })
  @ApiResponse({ status: 200, description: 'Total points retrieved successfully' })
  async getTotalPoints(@Req() req: Request) {
    const user = req.user as User;
    const total = await this.pointsService.getTotalPoints(user.id);
    return {
      totalPoints: total,
      userId: user.id,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get points history for authenticated user' })
  @ApiResponse({ status: 200, description: 'Points history retrieved successfully' })
  async getPointsHistory(@Req() req: Request) {
    const user = req.user as User;
    const history = await this.pointsService.getPointsHistory(user.id);
    const total = await this.pointsService.getTotalPoints(user.id);
    
    return {
      history,
      total,
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a point manually by code (for internal orders)' })
  @ApiResponse({ status: 201, description: 'Point registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  @ApiResponse({ status: 404, description: 'Point code not found' })
  @ApiResponse({ status: 409, description: 'Point code already used or registered' })
  async registerPointByCode(
    @Req() req: Request,
    @Body() body: { code: string }
  ) {
    const user = req.user as User;
    const { code } = body;
    
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Point code is required');
    }

    const pointRecord = await this.pointsService.registerPointByCode(
      user.id,
      code.toUpperCase().trim()
    );

    const newTotal = await this.pointsService.getTotalPoints(user.id);

    return {
      success: true,
      message: 'Point registered successfully',
      pointRecord,
      newTotal,
    };
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available points (not canceled, not redeemed) for authenticated user' })
  @ApiResponse({ status: 200, description: 'Available points retrieved successfully' })
  async getAvailablePoints(@Req() req: Request) {
    const user = req.user as User;
    const available = await this.pointsService.getAvailablePoints(user.id);
    const total = await this.pointsService.getTotalPoints(user.id);
    
    return {
      availablePoints: available,
      totalPoints: total,
      userId: user.id,
    };
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem 9 points for a prize (half chicken free)' })
  @ApiResponse({ status: 201, description: 'Points redeemed successfully, prize created' })
  @ApiResponse({ status: 400, description: 'Not enough points to redeem' })
  async redeemPoints(@Req() req: Request) {
    const user = req.user as User;
    
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

  @Get('redemptions')
  @ApiOperation({ summary: 'Get all redemption prizes for authenticated user' })
  @ApiResponse({ status: 200, description: 'Redemption prizes retrieved successfully' })
  async getRedemptions(@Req() req: Request) {
    const user = req.user as User;
    const all = await this.pointsService.getUserRedemptions(user.id);
    const active = await this.pointsService.getActiveRedemptions(user.id);

    return {
      all,
      active,
    };
  }

  @Post('validate-redemption')
  @ApiOperation({ summary: 'Validate a redemption code (for applying to orders)' })
  @ApiResponse({ status: 200, description: 'Redemption code is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'Redemption code not found' })
  @ApiResponse({ status: 409, description: 'Redemption code already used' })
  async validateRedemption(
    @Req() req: Request,
    @Body() body: { code: string }
  ) {
    const { code } = body;
    
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Redemption code is required');
    }

    const redemption = await this.pointsService.validateRedemptionCode(code.toUpperCase().trim());

    return {
      valid: true,
      code: redemption.code,
      expiresAt: redemption.expiresAt,
      message: 'Redemption code is valid and can be used',
    };
  }
}
