import { BoldOnlineController } from './bold-online.controller';
import { BoldOnlineService } from './bold-online.service';
import { BoldQrAttempt, BoldOnlineSettings } from './entities/bold-qr.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoldReceipt, BoldEvent } from './entities/bold-receipt.entity';
import { BoldController } from './bold.controller';
import { BoldService } from './bold.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BoldReceipt,
      BoldEvent,
      BoldQrAttempt,
      BoldOnlineSettings,
    ]),
  ],
  controllers: [BoldController, BoldOnlineController],
  providers: [BoldService, BoldOnlineService],
})
export class BoldModule {}
