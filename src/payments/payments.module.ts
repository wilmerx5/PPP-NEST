import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { BusinessModule } from '../business/business.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order]),
    ConfigModule, // Para acceder a ConfigService (webhook secret, URLs, etc.)
    CommonModule, // Para usar MailService y enviar correos de confirmación
    BusinessModule,
    ProductsModule,
    OrdersModule, // Importamos OrdersModule para usar OrdersService
    AuthModule, // Importamos AuthModule para usar las estrategias de Passport
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
