import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoldReceipt, BoldEvent } from './entities/bold-receipt.entity';
import { BoldController } from './bold.controller';
import { BoldService } from './bold.service';
@Module({
  imports: [TypeOrmModule.forFeature([BoldReceipt, BoldEvent])],
  controllers: [BoldController],
  providers: [BoldService],
})
export class BoldModule {}
