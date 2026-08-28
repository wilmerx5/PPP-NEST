import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { FactusApiClient } from './factus-api.client';
import { FactusAuthService } from './factus-auth.service';
import { FactusInvoiceMapper } from './factus-invoice.mapper';
import { FactusService } from './factus.service';
import { FactusController } from './factus.controller';
import { InvoiceCustomer } from './entities/invoice-customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, InvoiceCustomer])],
  controllers: [FactusController],
  providers: [FactusAuthService, FactusApiClient, FactusInvoiceMapper, FactusService],
  exports: [FactusService, FactusAuthService],
})
export class FactusModule {}
