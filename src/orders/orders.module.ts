import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './Websocket/order.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderItemAttribute]),
    AuthModule,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
