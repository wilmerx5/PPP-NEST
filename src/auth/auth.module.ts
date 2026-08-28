import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from 'src/common/common.module';
import { CookieService } from './cookie.service';
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { Address } from './entities/address.entity';
import { Phone } from './entities/phone.entity';
import { JwtStrategy } from './stretegies/jwt.strategy';
import { RefreshTokenStrategy } from './stretegies/refresh-token.strategy';
import { GoogleStrategy } from './stretegies/google.strategy';
import { UserAddressesController } from './user-addresses.controller';
import { UserAddressesService } from './user-addresses.service';
import { UserPhonesController } from './user-phones.controller';
import { UserPhonesService } from './user-phones.service';
import { PointsService } from './services/points.service';
import { TotpService } from './services/totp.service';
import { PointsController } from './points.controller';
import { AdminController } from './admin.controller';
import { UserPoints } from './entities/user-points.entity';
import { PointRedemption } from './entities/point-redemption.entity';
import { ProductsModule } from '../products/products.module';
import { Product } from '../products/entities/product.entity';
import { OrdersModule } from '../orders/orders.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { BusinessModule } from '../business/business.module';

@Module({
  controllers: [AuthController, UserAddressesController, UserPhonesController, PointsController, AdminController],
  providers: [
    AuthService,
    TotpService,
    JwtStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    CookieService,
    UserAddressesService,
    UserPhonesService,
    PointsService,
  ],
  imports: [
    CommonModule,
    ConfigModule,
    ProductsModule,
    forwardRef(() => OrdersModule),
    ExpensesModule,
    BusinessModule,
    TypeOrmModule.forFeature([User, VerificationToken, Address, Phone, UserPoints, PointRedemption, Product]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get("JWT_SECRET"),
          signOptions: {
            expiresIn: '15m',
          }
        }
      }
    })
  ],


  exports: [TypeOrmModule, JwtStrategy, PassportModule, JwtModule, PointsService]
})
export class AuthModule { }
