import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Patch,
    Post,
    Query,
    Req,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';

import {
    AddOrderExtraDto,
    AppendOrderItemsDto,
    ChangeTableDto,
    CreateOrderDto,
    DeliveryQuoteDto,
    LinkTablesDto,
    RemoveOrderItemsDto,
    UpdateOrderExtraDto,
    UpdateOrderGeneralDto,
    UpdateOrderItemUnitPriceDto,
    UpdateOrderItemsDto,
} from './DTOS/orderDTO';
import { OrdersService } from './orders.service';
import { WebDeliveryService } from '../delivery/web-delivery.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { ValidRoles } from '../auth/interfaces/valid.roles.interface';

/** Staff operativo (cocina, mesas, enviador, admin). */
const STAFF = [
  ValidRoles.admin,
  ValidRoles.ordersUser,
  ValidRoles.tableUser,
  ValidRoles.kitchenUser,
] as const;

/** Mutaciones de pedido / mesas (sin cocina). */
const OPS = [
  ValidRoles.admin,
  ValidRoles.ordersUser,
  ValidRoles.tableUser,
] as const;

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {

  constructor(
    private readonly orderService: OrdersService,
    private readonly webDelivery: WebDeliveryService,
  ) {}

  // -------------------------------------------------------------
  // MIS PEDIDOS (usuario autenticado)
  // -------------------------------------------------------------
  @Get('mine')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mis pedidos',
    description: 'Devuelve las órdenes del usuario autenticado (por email). Requiere JWT.',
  })
  @ApiResponse({ status: 200, description: 'Lista de órdenes del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMine(@Req() req: any) {
    const email = req.user?.email;
    if (!email) {
      return [];
    }
    return this.orderService.findMine(email);
  }

  // -------------------------------------------------------------
  // CREATE ORDER — público (checkout online). Staff también usa cookies.
  // -------------------------------------------------------------
  @Post()
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order with customer info, items, attributes and notifies kitchen via WebSockets. Public for online checkout.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = (createOrderDto.clientRequestId || idempotencyKey || '').trim();
    if (key) {
      createOrderDto.clientRequestId = key.slice(0, 64);
    }
    return this.orderService.create(createOrderDto);
  }

  // -------------------------------------------------------------
  // COTIZAR DOMICILIO — checkout online
  // -------------------------------------------------------------
  @Post('delivery-quote')
  @ApiOperation({
    summary: 'Cotizar domicilio para pedidos online',
    description:
      'Calcula el costo de envío según distancia por ruta. Hasta 4 km: $4.000; más de 4 km: $6.000 (máx. 6 km).',
  })
  @ApiBody({ type: DeliveryQuoteDto })
  @ApiResponse({ status: 200, description: 'Cotización de domicilio' })
  async quoteDelivery(@Body() body: DeliveryQuoteDto) {
    const [quote, config] = await Promise.all([
      this.webDelivery.quote({
        address: body.address,
        lat: body.lat,
        lng: body.lng,
      }),
      this.webDelivery.getConfig(),
    ]);
    return {
      ...quote,
      tiersHint: config.tiersHint,
      maxKm: config.maxKm,
      tiers: config.tiers,
    };
  }

  // -------------------------------------------------------------
  // FIND TODAY ORDERS — solo staff
  // -------------------------------------------------------------
  @Get('daily')
  @Auth(...STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all orders of today',
    description:
      'Returns all orders created today (Bogotá timezone), excluding canceled ones. Optional orderType (e.g. "table") filters by type for lighter payload (e.g. mesas app).',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso' })
  async getTodayOrders(@Query('orderType') orderType?: string) {
    return this.orderService.findOrdersToday(orderType);
  }

  // -------------------------------------------------------------
  // VALIDATE REDEMPTION (antes de :id para no capturar mal la ruta)
  // -------------------------------------------------------------
  @Post('validate-redemption-prize')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validate a redemption prize code',
    description: 'Validates a redemption prize code. Requires staff auth.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          example: 'REDEEM9PTSX7',
          description: '12-character redemption code',
        },
      },
      required: ['code'],
    },
  })
  @ApiResponse({ status: 200, description: 'Prize code is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'Prize code not found' })
  @ApiResponse({ status: 409, description: 'Prize code already used' })
  async validateRedemptionPrize(
    @Body() body: { code: string },
  ) {
    const { code } = body;
    if (!code) {
      throw new BadRequestException('Redemption code is required');
    }

    const redemption = await this.orderService.validateRedemptionCodePublic(code.toUpperCase().trim());

    return {
      valid: true,
      code: redemption.code,
      expiresAt: redemption.expiresAt,
      message: 'Redemption code is valid and can be used',
    };
  }

  // -------------------------------------------------------------
  // DELETE ORDER
  // -------------------------------------------------------------
  @Delete(':id')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancels the order and restores inventory. Use force=true to annul an already completed order (operational mistake).',
  })
  @ApiParam({ name: 'id', example: 15, description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order canceled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async deleteOrder(
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    const orderId = parseInt(id, 10);
    const forceCancel = force === '1' || force === 'true';
    return this.orderService.removeOrder(orderId, forceCancel);
  }

  // -------------------------------------------------------------
  // UPDATE ORDER ITEMS
  // -------------------------------------------------------------
  @Patch(':id/items/unit-price')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Apply unit price (discount) to a product in the order',
    description: 'Updates the unit price for all order items of the given product. Does not change inventory.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: UpdateOrderItemUnitPriceDto })
  @ApiResponse({ status: 200, description: 'Unit price updated; returns formatted order' })
  @ApiResponse({ status: 404, description: 'Order or product not found' })
  async updateItemUnitPrice(
    @Param('id') id: string,
    @Body() dto: UpdateOrderItemUnitPriceDto
  ) {
    const orderId = parseInt(id, 10);
    return this.orderService.updateOrderItemUnitPrice(orderId, dto);
  }

  @Post(':id/items')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Append items to an order (delta)',
    description:
      'Adds ONLY the given items to the order without replacing existing ones. Prefer this over PATCH for "add product".',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: AppendOrderItemsDto })
  @ApiResponse({ status: 201, description: 'Items appended; returns formatted order' })
  async appendItems(@Param('id') id: string, @Body() dto: AppendOrderItemsDto) {
    return this.orderService.appendOrderItems(parseInt(id, 10), dto);
  }

  @Delete(':id/items')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove items from an order (delta)',
    description:
      'Removes all units of a product, or a single unit by unitIndex. Does not require resending the rest of the order.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: RemoveOrderItemsDto })
  @ApiResponse({ status: 200, description: 'Items removed; returns formatted order' })
  async removeItems(@Param('id') id: string, @Body() dto: RemoveOrderItemsDto) {
    return this.orderService.removeOrderItems(parseInt(id, 10), dto);
  }

  @Patch(':id/items')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replace all items in an order',
    description:
      'Full replace of items (legacy). Prefer POST/DELETE delta endpoints for add/remove. Still used for edit-variants.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: UpdateOrderItemsDto })
  @ApiResponse({ status: 200, description: 'Order items updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateItems(
    @Param('id') id: string,
    @Body() dto: UpdateOrderItemsDto
  ) {
    const orderId = parseInt(id, 10);
    return this.orderService.updateOrderItems(orderId, dto);
  }

  // -------------------------------------------------------------
  // EXTRAS (ADD / DELETE / UPDATE)
  // -------------------------------------------------------------
  @Post(':id/extras')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an extra to an order', description: 'Adds an additional charge (código 90) to an existing order.' })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: AddOrderExtraDto })
  @ApiResponse({ status: 201, description: 'Extra added' })
  @ApiResponse({ status: 404, description: 'Order not found or canceled' })
  async addExtra(@Param('id') id: string, @Body() dto: AddOrderExtraDto) {
    return this.orderService.addExtra(parseInt(id, 10), dto);
  }

  @Delete(':id/extras/:extraId')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an extra from an order' })
  @ApiParam({ name: 'id', example: 15 })
  @ApiParam({ name: 'extraId', example: 1 })
  @ApiResponse({ status: 200, description: 'Extra deleted' })
  @ApiResponse({ status: 404, description: 'Extra not found' })
  async deleteExtra(@Param('id') id: string, @Param('extraId') extraId: string) {
    return this.orderService.deleteExtra(parseInt(id, 10), parseInt(extraId, 10));
  }

  @Patch(':id/extras/:extraId')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an extra on an order' })
  @ApiParam({ name: 'id', example: 15 })
  @ApiParam({ name: 'extraId', example: 1 })
  @ApiBody({ type: UpdateOrderExtraDto })
  @ApiResponse({ status: 200, description: 'Extra updated' })
  @ApiResponse({ status: 404, description: 'Extra not found' })
  async updateExtra(
    @Param('id') id: string,
    @Param('extraId') extraId: string,
    @Body() dto: UpdateOrderExtraDto,
  ) {
    return this.orderService.updateExtra(parseInt(id, 10), parseInt(extraId, 10), dto);
  }

  // -------------------------------------------------------------
  // UPDATE ORDER GENERAL INFO — staff (cocina cambia status)
  // -------------------------------------------------------------
  @Patch(':id/info')
  @Auth(...STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update general information of an order',
    description:
      'Updates order fields such as customerName, phone, address, orderStatus, orderType, printed flag, etc.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: UpdateOrderGeneralDto })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderGeneral(
    @Param('id') id: number,
    @Body() dto: UpdateOrderGeneralDto,
  ) {
    return this.orderService.updateOrderGeneral(+id, dto);
  }

  @Patch(':id/table')
  @Auth(ValidRoles.admin, ValidRoles.tableUser)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change table of an order (mesas)',
    description:
      'Moves order to another table. If the target table has an active order, both orders swap tables.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: ChangeTableDto })
  @ApiResponse({ status: 200, description: 'Table changed (or swapped) successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request (e.g. same table, non-table order)' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async changeTable(@Param('id') id: string, @Body() dto: ChangeTableDto) {
    return this.orderService.changeTable(parseInt(id, 10), dto);
  }

  @Post(':id/table-link')
  @Auth(ValidRoles.admin, ValidRoles.tableUser)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link table orders (mesas)',
    description: 'Links this table order with other active table orders for a unified bill.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({ type: LinkTablesDto })
  @ApiResponse({ status: 200, description: 'Tables linked successfully' })
  async linkTables(@Param('id') id: string, @Body() dto: LinkTablesDto) {
    return this.orderService.linkTables(parseInt(id, 10), dto.tableNumbers);
  }

  @Delete(':id/table-link')
  @Auth(ValidRoles.admin, ValidRoles.tableUser)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unlink table from group (mesas)',
    description: 'Removes this table from the linked group.',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiResponse({ status: 200, description: 'Table unlinked successfully' })
  async unlinkTable(@Param('id') id: string) {
    return this.orderService.unlinkTable(parseInt(id, 10));
  }

  // APPLY REDEMPTION PRIZE
  // -------------------------------------------------------------
  @Post(':id/apply-voucher')
  @Auth(...OPS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Apply a redemption prize to an order',
    description:
      'Applies a redemption prize (from 9 points redemption) to an order. Validates that the order contains a half chicken (product code 2 or 5).',
  })
  @ApiParam({ name: 'id', example: 15 })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        redemptionCode: {
          type: 'string',
          example: 'REDEEM9PTSX7',
          description: '12-character redemption code',
        },
      },
      required: ['redemptionCode'],
    },
  })
  @ApiResponse({ status: 200, description: 'Prize applied successfully' })
  @ApiResponse({ status: 400, description: 'Invalid prize or order does not contain half chicken' })
  @ApiResponse({ status: 404, description: 'Order or prize not found' })
  async applyRedemptionVoucher(
    @Param('id') id: number,
    @Body() body: { redemptionCode: string },
  ) {
    const { redemptionCode } = body;
    if (!redemptionCode) {
      throw new BadRequestException('Redemption code is required');
    }
    await this.orderService.applyRedemptionVoucher(+id, redemptionCode);
    return {
      success: true,
      message: 'Redemption prize applied successfully',
    };
  }

}
