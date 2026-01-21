import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
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
import { AuthGuard } from '@nestjs/passport';

import {
    CreateOrderDto,
    UpdateOrderGeneralDto,
    UpdateOrderItemsDto
} from './DTOS/orderDTO';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {

  constructor(private readonly orderService: OrdersService) {}

  // -------------------------------------------------------------
  // MIS PEDIDOS (usuario autenticado)
  // -------------------------------------------------------------
  @Get('mine')
  @UseGuards(AuthGuard('jwt'))
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
  // CREATE ORDER
  // -------------------------------------------------------------
  @Post()
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order with customer info, items, attributes and notifies kitchen via WebSockets.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  // -------------------------------------------------------------
  // FIND TODAY ORDERS
  // -------------------------------------------------------------
  @Get('daily')
  @ApiOperation({
    summary: 'Get all orders of today',
    description:
      'Returns all orders created today (Bogotá timezone), excluding canceled ones.',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getTodayOrders() {
    const orders = await this.orderService.findOrdersToday();
    // Log for debugging - check if points are being returned
    if (orders && orders.length > 0) {
      console.log(`[getTodayOrders] Returning ${orders.length} orders`);
      orders.forEach((order, idx) => {
        if (order.points > 0 || (order.pointCodes && order.pointCodes.length > 0)) {
          console.log(`[getTodayOrders] Order #${order.dailyOrderNumber} - points: ${order.points}, pointCodes.length: ${order.pointCodes?.length || 0}`);
        }
      });
    }
    return orders;
  }

  // -------------------------------------------------------------
  // DELETE ORDER
  // -------------------------------------------------------------
  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Marks the order as canceled and notifies kitchen.',
  })
  @ApiParam({ name: 'id', example: 15, description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order canceled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async deleteOrder(@Param('id') id: string) {
    const orderId = parseInt(id, 10);
    return this.orderService.removeOrder(orderId);
  }

  // -------------------------------------------------------------
  // UPDATE ORDER ITEMS
  // -------------------------------------------------------------
  @Patch(':id/items')
  @ApiOperation({
    summary: 'Update the list of items in an order',
    description:
      'Replaces all items and attributes of the order. If items are empty, the order is canceled.',
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
  // UPDATE ORDER GENERAL INFO
  // -------------------------------------------------------------
  @Patch(':id/info')
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

  // -------------------------------------------------------------
  // VALIDATE REDEMPTION PRIZE (PUBLIC - for internal orders app)
  // -------------------------------------------------------------
  @Post('validate-redemption-prize')
  @ApiOperation({
    summary: 'Validate a redemption prize code (public endpoint for internal orders)',
    description:
      'Validates a redemption prize code without requiring authentication. Used by internal order management apps.',
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

  // APPLY REDEMPTION PRIZE
  // -------------------------------------------------------------
  @Post(':id/apply-voucher')
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
