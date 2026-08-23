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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
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
import { BusinessService } from '../business/business.service';
import {
  CreateHolidayClosureDto,
  UpdateRestaurantSettingsDto,
} from '../business/dto/business.dto';
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
    private readonly businessService: BusinessService,
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
    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'isActive'],
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.isActive === body.isActive) {
      return {
        success: true,
        message: body.isActive ? 'Usuario ya estaba activo' : 'Usuario ya estaba inactivo',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
        },
      };
    }

    await this.userRepo.update({ id }, { isActive: body.isActive });

    return {
      success: true,
      message: body.isActive ? 'Usuario activado' : 'Usuario desactivado',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isActive: body.isActive,
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
      throw error;
    }
  }

  @Post('points/assign')
  @ApiOperation({ summary: 'Assign points directly to a user (admin only). Same as if the user registered them.' })
  @ApiResponse({ status: 201, description: 'Points assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async assignPoints(
    @Body() body: { userId: string; pointsCount: number; description?: string },
  ) {
    const { userId, pointsCount, description } = body;

    if (!userId) {
      throw new BadRequestException('El usuario es obligatorio');
    }

    if (!pointsCount) {
      throw new BadRequestException('La cantidad de puntos es obligatoria');
    }

    const pointsRecords = await this.pointsService.assignPointsToUser(
      userId,
      pointsCount,
      description,
    );

    const newTotal = await this.pointsService.getTotalPoints(userId);

    return {
      success: true,
      message: `${pointsCount} punto(s) asignado(s) exitosamente`,
      points: pointsRecords,
      newTotal,
    };
  }

  @Post('points/assign-code')
  @ApiOperation({ summary: 'Assign an existing unassigned point code to a user (admin only). Same as manual registration.' })
  @ApiResponse({ status: 201, description: 'Point assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Point or user not found' })
  @ApiResponse({ status: 409, description: 'Point already used or assigned' })
  async assignPointByCode(
    @Body() body: { userId: string; code: string },
  ) {
    const { userId, code } = body;

    if (!userId) {
      throw new BadRequestException('El usuario es obligatorio');
    }

    if (!code?.trim()) {
      throw new BadRequestException('El código del punto es obligatorio');
    }

    const pointRecord = await this.pointsService.registerPointByCode(
      userId,
      code.toUpperCase().trim(),
    );

    const newTotal = await this.pointsService.getTotalPoints(userId);

    return {
      success: true,
      message: 'Punto asignado exitosamente',
      pointRecord,
      newTotal,
    };
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
  @ApiQuery({ name: 'period', required: false, description: '7d | 30d | ytd (año en curso desde 21 ene 2026 en 2026)' })
  @ApiResponse({ status: 200, description: 'Sales report retrieved successfully' })
  async getSalesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('period') period?: string,
  ) {
    const MIN_STATS = '2026-01-21';
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
    } else if (period === 'ytd') {
      toStr = todayBogota;
      const y = parseInt(todayBogota.slice(0, 4), 10);
      fromStr = y === 2026 ? MIN_STATS : `${y}-01-01`;
      if (fromStr < MIN_STATS) fromStr = MIN_STATS;
    } else if (from && to) {
      fromStr = from;
      toStr = to;
    } else {
      throw new BadRequestException('Indica periodo=7d|30d|ytd o las fechas from y to (YYYY-MM-DD)');
    }

    if (fromStr < MIN_STATS) fromStr = MIN_STATS;
    if (fromStr > toStr) {
      throw new BadRequestException('El rango debe empezar el 21 ene 2026 o después y la fecha fin no puede ser anterior');
    }

    return this.ordersService.getSalesReport(fromStr, toStr);
  }

  @Get('reports/sales/monthly-summary')
  @ApiOperation({ summary: 'Ventas por mes en un año (desde 21 ene 2026 en 2026)' })
  @ApiQuery({ name: 'year', required: false, description: 'Año (mín. 2026), por defecto año actual Bogotá' })
  async getMonthlySalesSummary(@Query('year') yearStr?: string) {
    const { formatInTimeZone } = await import('date-fns-tz');
    const y = yearStr ? parseInt(yearStr, 10) : parseInt(formatInTimeZone(new Date(), 'America/Bogota', 'yyyy'), 10);
    if (!Number.isFinite(y) || y < 2026) {
      throw new BadRequestException('Indica un año >= 2026');
    }
    return this.ordersService.getMonthlySalesSummary(y);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products including inactive (admin only)' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async getAllProducts() {
    return this.productsService.findAllForAdmin();
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update category (image URL for landing/menu)' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { imageUrl?: string | null },
  ) {
    return this.productsService.updateCategory(+id, body);
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

  @Post('products/:id/inventory/adjust')
  @ApiOperation({ summary: 'Adjust product stock by delta (admin only). delta > 0 = add, delta < 0 = subtract.' })
  @ApiBody({ schema: { type: 'object', properties: { delta: { type: 'number' } }, required: ['delta'] } })
  @ApiResponse({ status: 200, description: 'Stock adjusted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async adjustProductInventory(@Param('id') id: string, @Body() body: { delta: number }) {
    const delta = typeof body.delta === 'number' ? body.delta : Number(body.delta);
    if (!Number.isFinite(delta)) throw new BadRequestException('delta debe ser un número');
    return this.productsService.adjustStock(+id, delta);
  }

  @Post('products/:id/inventory/variant/adjust')
  @ApiOperation({ summary: 'Adjust variant stock by delta (admin only). attributeName + attributeValue identify the variant.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        attributeName: { type: 'string' },
        attributeValue: { type: 'string' },
        delta: { type: 'number' },
      },
      required: ['attributeName', 'attributeValue', 'delta'],
    },
  })
  @ApiResponse({ status: 200, description: 'Variant stock adjusted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async adjustProductVariantInventory(
    @Param('id') id: string,
    @Body() body: { attributeName: string; attributeValue: string; delta: number },
  ) {
    const { attributeName, attributeValue, delta } = body;
    if (!attributeName?.trim() || !attributeValue?.trim()) throw new BadRequestException('attributeName y attributeValue son requeridos');
    const d = typeof delta === 'number' ? delta : Number(delta);
    if (!Number.isFinite(d)) throw new BadRequestException('delta debe ser un número');
    return this.productsService.adjustVariantStock(+id, attributeName.trim(), attributeValue.trim(), d);
  }

  @Get('inventory-groups')
  @ApiOperation({ summary: 'List all inventory groups with items and stock (admin only)' })
  @ApiResponse({ status: 200, description: 'Groups with items' })
  async getInventoryGroups() {
    return this.productsService.findAllInventoryGroups();
  }

  @Post('inventory-groups')
  @ApiOperation({ summary: 'Create inventory group (admin only)' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } })
  @ApiResponse({ status: 201, description: 'Group created' })
  async createInventoryGroup(@Body() body: { name: string }) {
    if (!body.name?.trim()) throw new BadRequestException('name es requerido');
    return this.productsService.createInventoryGroup(body.name.trim());
  }

  @Patch('inventory-groups/:id')
  @ApiOperation({ summary: 'Update inventory group name (admin only)' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Group updated' })
  async updateInventoryGroup(@Param('id') id: string, @Body() body: { name: string }) {
    if (!body.name?.trim()) throw new BadRequestException('name es requerido');
    await this.productsService.updateInventoryGroup(+id, body.name.trim());
    return { success: true };
  }

  @Delete('inventory-groups/:id')
  @ApiOperation({ summary: 'Delete inventory group (admin only)' })
  @ApiResponse({ status: 200, description: 'Group deleted' })
  async deleteInventoryGroup(@Param('id') id: string) {
    await this.productsService.deleteInventoryGroup(+id);
    return { success: true };
  }

  @Post('inventory-groups/:id/items')
  @ApiOperation({ summary: 'Add product or product variant to inventory group (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        baseUnits: { type: 'number' },
        attributeName: { type: 'string' },
        attributeValue: { type: 'string' },
      },
      required: ['productId', 'baseUnits'],
    },
  })
  @ApiResponse({ status: 201, description: 'Item added' })
  async addInventoryGroupItem(
    @Param('id') id: string,
    @Body() body: { productId: number; baseUnits: number; attributeName?: string; attributeValue?: string },
  ) {
    const baseUnits = typeof body.baseUnits === 'number' ? body.baseUnits : Number(body.baseUnits);
    if (!Number.isFinite(baseUnits) || baseUnits < 0) throw new BadRequestException('baseUnits debe ser un número >= 0');
    return this.productsService.addInventoryGroupItem(
      +id,
      body.productId,
      baseUnits,
      body.attributeName,
      body.attributeValue,
    );
  }

  @Delete('inventory-groups/:id/items/:productId')
  @ApiOperation({ summary: 'Remove product or product variant from inventory group (admin only)' })
  @ApiQuery({ name: 'attributeName', required: false })
  @ApiQuery({ name: 'attributeValue', required: false })
  @ApiResponse({ status: 200, description: 'Item removed' })
  async removeInventoryGroupItem(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Query('attributeName') attributeName?: string,
    @Query('attributeValue') attributeValue?: string,
  ) {
    await this.productsService.removeInventoryGroupItem(
      +id,
      +productId,
      attributeName,
      attributeValue,
    );
    return { success: true };
  }

  @Patch('inventory-groups/:id/items/set-also-deduct')
  @ApiOperation({ summary: 'Set "also deduct from" for a group item (admin only). Variant is taken from the order at runtime.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        attributeName: { type: 'string' },
        attributeValue: { type: 'string' },
        alsoDeductProductId: { type: 'number' },
        alsoDeductBaseUnits: { type: 'number' },
      },
      required: ['productId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Also-deduct updated' })
  async setGroupItemAlsoDeduct(
    @Param('id') id: string,
    @Body() body: {
      productId: number;
      attributeName?: string;
      attributeValue?: string;
      alsoDeductProductId?: number | null;
      alsoDeductAttributeName?: string | null;
      alsoDeductAttributeValue?: string | null;
      alsoDeductBaseUnits?: number | null;
    },
  ) {
    const alsoDeduct =
      body.alsoDeductProductId != null &&
      body.alsoDeductBaseUnits != null &&
      Number(body.alsoDeductBaseUnits) > 0
        ? {
            productId: body.alsoDeductProductId,
            baseUnits: Number(body.alsoDeductBaseUnits),
            attributeName: body.alsoDeductAttributeName?.trim() || null,
            attributeValue: body.alsoDeductAttributeValue?.trim() || null,
          }
        : null;
    await this.productsService.setGroupItemAlsoDeduct(
      +id,
      body.productId,
      body.attributeName,
      body.attributeValue,
      alsoDeduct,
    );
    return { success: true };
  }

  @Post('inventory-groups/:id/items/selections')
  @ApiOperation({ summary: 'Create a named selection for a group item (e.g. "Bebida" with products 28 and 37)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'number' },
        attributeName: { type: 'string' },
        attributeValue: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['productId', 'name'],
    },
  })
  async createSelection(
    @Param('id') id: string,
    @Body() body: { productId: number; attributeName?: string; attributeValue?: string; name: string },
  ) {
    return this.productsService.createSelection(
      +id,
      body.productId,
      body.name,
      body.attributeName,
      body.attributeValue,
    );
  }

  @Patch('inventory-groups/selections/:selectionId')
  @ApiOperation({ summary: 'Update selection name' })
  async updateSelection(@Param('selectionId') selectionId: string, @Body() body: { name: string }) {
    await this.productsService.updateSelection(+selectionId, body.name?.trim() ?? '');
  }

  @Delete('inventory-groups/selections/:selectionId')
  @ApiOperation({ summary: 'Delete a selection and its product links' })
  async deleteSelection(@Param('selectionId') selectionId: string) {
    await this.productsService.deleteSelection(+selectionId);
  }

  @Post('inventory-groups/selections/:selectionId/products')
  @ApiOperation({ summary: 'Add a product to a selection' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { productId: { type: 'number' }, baseUnits: { type: 'number' }, sortOrder: { type: 'number' } },
      required: ['productId'],
    },
  })
  async addProductToSelection(
    @Param('selectionId') selectionId: string,
    @Body() body: { productId: number; baseUnits?: number; sortOrder?: number },
  ) {
    return this.productsService.addProductToSelection(
      +selectionId,
      body.productId,
      body.baseUnits ?? 0,
      body.sortOrder ?? 0,
    );
  }

  @Delete('inventory-groups/selections/:selectionId/products/:productId')
  @ApiOperation({ summary: 'Remove a product from a selection' })
  async removeProductFromSelection(
    @Param('selectionId') selectionId: string,
    @Param('productId') productId: string,
  ) {
    await this.productsService.removeProductFromSelection(+selectionId, +productId);
  }

  @Post('inventory-groups/:id/adjust')
  @ApiOperation({ summary: 'Adjust group stock by delta (admin only). Units in base (e.g. whole chickens).' })
  @ApiBody({ schema: { type: 'object', properties: { delta: { type: 'number' } }, required: ['delta'] } })
  @ApiResponse({ status: 200, description: 'Group stock adjusted' })
  async adjustInventoryGroupStock(@Param('id') id: string, @Body() body: { delta: number }) {
    const delta = typeof body.delta === 'number' ? body.delta : Number(body.delta);
    if (!Number.isFinite(delta)) throw new BadRequestException('delta debe ser un número');
    return this.productsService.adjustGroupStock(+id, delta);
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
    const active = points.filter((p) => !p.isCanceled);
    const total = active.length;
    const used = active.filter((p) => p.isUsed).length;
    const unused = total - used;
    const canceled = points.length - active.length;
    const assigned = active.filter((p) => !!p.userId).length;
    return { total, used, unused, canceled, assigned };
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

  @Get('business/settings')
  @ApiOperation({ summary: 'Get restaurant hours / timezone (admin)' })
  getBusinessSettings() {
    return this.businessService.getSettings();
  }

  @Patch('business/settings')
  @ApiOperation({ summary: 'Update restaurant timezone, weekly closed days and hours' })
  updateBusinessSettings(@Body() dto: UpdateRestaurantSettingsDto) {
    return this.businessService.updateSettings(dto);
  }

  @Get('business/closures')
  @ApiOperation({ summary: 'List holiday closures (admin)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listBusinessClosures(@Query('from') from?: string, @Query('to') to?: string) {
    return this.businessService.listClosures(from, to);
  }

  @Post('business/closures')
  @ApiOperation({ summary: 'Create a holiday / closed date' })
  createBusinessClosure(@Body() dto: CreateHolidayClosureDto) {
    return this.businessService.createClosure(dto);
  }

  @Delete('business/closures/:id')
  @ApiOperation({ summary: 'Delete a holiday closure' })
  async deleteBusinessClosure(@Param('id') id: string) {
    await this.businessService.deleteClosure(parseInt(id, 10));
    return { success: true };
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
