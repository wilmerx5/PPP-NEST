import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post
} from '@nestjs/common';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';

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
    return this.orderService.findOrdersToday();
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

}
