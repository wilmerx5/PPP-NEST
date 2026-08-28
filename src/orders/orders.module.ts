import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemAttribute } from './entities/order-item-attribute.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderExtra } from './entities/order-extra.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersGateway } from './Websocket/order.gateway';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { CommonModule } from '../common/common.module';
import { BusinessModule } from '../business/business.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { FactusModule } from '../factus/factus.module';
import { User } from '../auth/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { UserPoints } from '../auth/entities/user-points.entity';
import { PointRedemption } from '../auth/entities/point-redemption.entity';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderItemAttribute, OrderExtra, User, Product, UserPoints, PointRedemption]),
    forwardRef(() => AuthModule),
    ProductsModule,
    CommonModule,
    BusinessModule,
    DeliveryModule,
    FactusModule,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
