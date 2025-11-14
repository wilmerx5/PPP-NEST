import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderGeneralDto, UpdateOrderItemsDto } from './DTOS/orderDTO';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {

    constructor(private readonly orderService: OrdersService) {

    }

    @Post()
    async createOrder(@Body() createOrderDto: CreateOrderDto) {
        return this.orderService.create(createOrderDto);
    }
    @Get('daily')
    async getTodayOrders() {
        return this.orderService.findOrdersToday();
    }

    @Delete(':id')
    async deleteOrder(@Param('id') id: string) {
        const orderId = parseInt(id, 10);
        return this.orderService.removeOrder(orderId);
    }

    @Patch(':id/items')
    async updateItems(
        @Param('id') id: string,
        @Body() dto: UpdateOrderItemsDto
    ) {
        const orderId = parseInt(id, 10);
        return this.orderService.updateOrderItems(orderId, dto);
    }

    @Patch(':id/info')
    async updateOrderGeneral(
        @Param('id') id: number,
        @Body() dto: UpdateOrderGeneralDto,
    ) {
        return this.orderService.updateOrderGeneral(+id, dto);
    }


}
