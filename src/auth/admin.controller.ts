import {
  Controller,
  Delete,
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
import { Between } from 'typeorm';
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
import { ExpensesService } from '../expenses/expenses.service';
import { getBogotaDateRange } from '../common/utils/date.util';
import { formatInTimeZone } from 'date-fns-tz';

@ApiTags('Admin')
@Controller('admin')
@Auth(ValidRoles.admin)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly expensesService: ExpensesService,
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
        '(user.fullName LIKE :q OR user.email LIKE :q OR user.phone LIKE :q)',
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
      throw new NotFoundException('Usuario no encontrado');
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
        throw new BadRequestException('La cantidad de puntos es obligatoria');
      }

      if (pointsCount < 1 || pointsCount > 100) {
        throw new BadRequestException('La cantidad de puntos debe estar entre 1 y 100');
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
      throw new BadRequestException('Usuario no encontrado');
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
      throw new BadRequestException('El parámetro fecha es obligatorio (formato YYYY-MM-DD)');
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
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
        throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
      }
    }

    const summary = await this.ordersService.getDailySummary(date);
    return summary;
  }

  @Post('orders/backfill-unit-prices')
  @ApiOperation({ summary: 'Backfill unit_price on order items where null (admin only)' })
  @ApiResponse({ status: 200, description: 'Number of rows updated' })
  async backfillOrderItemsUnitPrices() {
    const { updated } = await this.ordersService.backfillUnitPrices();
    return { success: true, updated };
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
      throw new BadRequestException('Indica periodo=7d|30d o las fechas from y to (YYYY-MM-DD)');
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

  @Get('points/records/summary')
  @ApiOperation({ summary: 'Points summary: total, used, unused. By date/period or allTime=1 (admin only).' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'allTime', required: false, description: '1 = all time' })
  @ApiResponse({ status: 200, description: 'Summary counts' })
  async getPointsSummary(
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('allTime') allTime?: string,
  ) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let qb = this.pointsRepo.createQueryBuilder('p').select('p');

    if (allTime === '1' || allTime === 'true') {
      // no date filter
    } else if (date && dateRegex.test(date)) {
      const range = getBogotaDateRange(date);
      qb = qb.where('p.createdAt >= :start', { start: range.start }).andWhere('p.createdAt <= :end', { end: range.end });
    } else if (from && to && dateRegex.test(from) && dateRegex.test(to)) {
      const startRange = getBogotaDateRange(from);
      const endRange = getBogotaDateRange(to);
      if (startRange.start > endRange.end) throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
      qb = qb.where('p.createdAt >= :start', { start: startRange.start }).andWhere('p.createdAt <= :end', { end: endRange.end });
    } else {
      throw new BadRequestException('Indica date=YYYY-MM-DD, from y to, o allTime=1');
    }

    const points = await qb.getMany();
    const total = points.length;
    const used = points.filter((p) => p.isUsed).length;
    const unused = total - used;
    return { total, used, unused };
  }

  @Get('points/records')
  @ApiOperation({ summary: 'List points records by date or period (admin only). Includes associated order.' })
  @ApiQuery({ name: 'date', required: false, description: 'Single day YYYY-MM-DD' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date YYYY-MM-DD (use with to)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date YYYY-MM-DD (use with from)' })
  @ApiResponse({ status: 200, description: 'Points records with order info' })
  async getPointsRecords(
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let startUtc: Date;
    let endUtc: Date;

    if (date) {
      if (!dateRegex.test(date)) throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
      const range = getBogotaDateRange(date);
      startUtc = range.start;
      endUtc = range.end;
    } else if (from && to) {
      if (!dateRegex.test(from) || !dateRegex.test(to)) throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
      const startRange = getBogotaDateRange(from);
      const endRange = getBogotaDateRange(to);
      startUtc = startRange.start;
      endUtc = endRange.end;
      if (startUtc > endUtc) throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
    } else {
      throw new BadRequestException('Indica date=YYYY-MM-DD o from y to (YYYY-MM-DD)');
    }

    const points = await this.pointsRepo.find({
      where: { createdAt: Between(startUtc, endUtc) },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const orderIds = points.map((p) => p.orderId).filter((id): id is number => id != null);
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
        orderCreatedAt: order?.createdAt ? formatInTimeZone(order.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm") : null,
        type: p.type,
        isUsed: p.isUsed,
        isCanceled: p.isCanceled,
        isRedeemed: p.isRedeemed,
        description: p.description,
        createdAt: formatInTimeZone(p.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss"),
      };
    });

    return { records, total: records.length };
  }

  @Get('points/records/search')
  @ApiOperation({ summary: 'Search point by code in all records (admin only). No date filter.' })
  @ApiQuery({ name: 'code', required: true, description: 'Point code (exact or partial)' })
  @ApiResponse({ status: 200, description: 'Matching points with full details' })
  async searchPointByCode(@Query('code') code: string) {
    const trimmed = code?.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new BadRequestException('El código debe tener al menos 2 caracteres');
    }

    const points = await this.pointsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .where('p.code LIKE :code', { code: `%${trimmed}%` })
      .orderBy('p.createdAt', 'DESC')
      .getMany();

    const orderIds = points.map((p) => p.orderId).filter((id): id is number => id != null);
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
        orderCreatedAt: order?.createdAt ? formatInTimeZone(order.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm") : null,
        type: p.type,
        isUsed: p.isUsed,
        isCanceled: p.isCanceled,
        isRedeemed: p.isRedeemed,
        description: p.description,
        createdAt: formatInTimeZone(p.createdAt, 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss"),
      };
    });

    return { records };
  }

  @Patch('points/records/:id/invalidate')
  @ApiOperation({ summary: 'Invalidate a point (admin only). Point will no longer be valid (e.g. like when order is canceled).' })
  @ApiResponse({ status: 200, description: 'Point invalidated' })
  @ApiResponse({ status: 404, description: 'Point not found' })
  async invalidatePoint(@Param('id') id: string) {
    const point = await this.pointsRepo.findOne({ where: { id: parseInt(id, 10) } });
    if (!point) throw new NotFoundException('Punto no encontrado');
    point.isCanceled = true;
    await this.pointsRepo.save(point);
    return { success: true, message: 'Punto invalidado', point: { id: point.id, code: point.code, isCanceled: true } };
  }

  @Patch('points/records/:id/redeem')
  @ApiOperation({ summary: 'Mark a point as redeemed manually (admin only). User will not be able to use it for prize accumulation.' })
  @ApiResponse({ status: 200, description: 'Point marked as redeemed' })
  @ApiResponse({ status: 404, description: 'Point not found' })
  async redeemPoint(@Param('id') id: string) {
    const point = await this.pointsRepo.findOne({ where: { id: parseInt(id, 10) } });
    if (!point) throw new NotFoundException('Punto no encontrado');
    if (point.isCanceled) {
      throw new BadRequestException('No se puede canjear un punto cancelado');
    }
    if (point.isRedeemed) {
      throw new BadRequestException('El punto ya está canjeado');
    }
    point.isRedeemed = true;
    await this.pointsRepo.save(point);
    return { success: true, message: 'Punto canjeado manualmente', point: { id: point.id, code: point.code, isRedeemed: true } };
  }

  @Get('expenses/categories')
  @ApiOperation({ summary: 'List expense categories (admin only)' })
  @ApiResponse({ status: 200, description: 'Categories list' })
  getExpenseCategories() {
    return { categories: this.expensesService.getCategories() };
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Create expense (admin only). expenseDate = YYYY-MM-DD (día en Colombia).' })
  @ApiResponse({ status: 201, description: 'Expense created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createExpense(
    @Body() body: { category: string; name: string; amount: number; expenseDate: string },
  ) {
    const expense = await this.expensesService.create(body);
    return { success: true, expense };
  }

  @Get('expenses')
  @ApiOperation({ summary: 'List expenses by period (admin only). Same date logic as orders (Bogotá).' })
  @ApiQuery({ name: 'from', required: true, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'End date YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Expenses list' })
  async getExpenses(@Query('from') from: string, @Query('to') to: string) {
    const list = await this.expensesService.findByPeriod(from, to);
    return { expenses: list };
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Delete expense (admin only)' })
  @ApiResponse({ status: 200, description: 'Expense deleted' })
  async deleteExpense(@Param('id') id: string) {
    await this.expensesService.delete(parseInt(id, 10));
    return { success: true };
  }

  @Get('expenses/stats')
  @ApiOperation({ summary: 'Sales vs expenses by period (admin only). Ventas, egresos, venta neta.' })
  @ApiQuery({ name: 'from', required: true, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'End date YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Stats with sales, expenses, net' })
  async getExpensesStats(@Query('from') from: string, @Query('to') to: string) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw new BadRequestException('Formato de fecha inválido. Usa YYYY-MM-DD');
    }
    if (from > to) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha fin');
    }
    const [salesReport, totalExpenses, expensesList] = await Promise.all([
      this.ordersService.getSalesReport(from, to),
      this.expensesService.getTotalByPeriod(from, to),
      this.expensesService.findByPeriod(from, to),
    ]);
    const salesTotal = salesReport?.totals?.total ?? 0;
    const net = salesTotal - totalExpenses;
    return {
      period: { from, to },
      sales: {
        total: salesTotal,
        totalOrders: salesReport?.totalOrders ?? 0,
        totals: salesReport?.totals ?? { subtotal: 0, deliveryFees: 0, premioDiscounts: 0, total: 0 },
      },
      expenses: {
        total: totalExpenses,
        count: expensesList.length,
        list: expensesList,
      },
      net,
    };
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
      throw new BadRequestException('El límite debe estar entre 1 y 500');
    }

    if (offsetNum < 0) {
      throw new BadRequestException('El desplazamiento debe ser mayor o igual a 0');
    }

    return await this.pointsService.getLeaderboard(limitNum, offsetNum, search);
  }
}
