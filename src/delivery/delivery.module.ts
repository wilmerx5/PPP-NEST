import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessModule } from '../business/business.module';
import { WhatsappDeliveryRoutingService } from '../whatsapp/whatsapp-delivery-routing.service';
import { WebDeliveryService } from './web-delivery.service';

@Module({
  imports: [ConfigModule, BusinessModule],
  providers: [WhatsappDeliveryRoutingService, WebDeliveryService],
  exports: [WhatsappDeliveryRoutingService, WebDeliveryService],
})
export class DeliveryModule {}
