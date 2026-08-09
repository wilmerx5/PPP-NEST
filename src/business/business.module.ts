import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantSettings } from './entities/restaurant-settings.entity';
import { HolidayClosure } from './entities/holiday-closure.entity';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantSettings, HolidayClosure])],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
