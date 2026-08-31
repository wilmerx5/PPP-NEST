import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { RestaurantSettings } from '../business/entities/restaurant-settings.entity';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
import { FactusInvoiceSettingsService } from './factus-invoice-settings.service';
import { FactusService } from './factus.service';
import { FactusController } from './factus.controller';
import { InvoiceCustomer } from './entities/invoice-customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, InvoiceCustomer, RestaurantSettings]),
    ProductsModule,
    // OrdersModule sigue importado por ciclo (OrdersService → FactusService → Order repo)
    forwardRef(() => OrdersModule),
  ],
  controllers: [FactusController],
  providers: [
    FactusAuthService,
    FactusApiClient,
    FactusInvoiceMapper,
    FactusInvoiceSettingsService,
    FactusService,
  ],
  exports: [FactusService, FactusAuthService, FactusInvoiceSettingsService],
})
export class FactusModule {}
