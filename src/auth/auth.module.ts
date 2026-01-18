import { Module } from '@nestjs/common';
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

@Module({
  controllers: [AuthController, UserAddressesController, UserPhonesController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    CookieService,
    UserAddressesService,
    UserPhonesService,
  ],
  imports: [
    CommonModule,
    ConfigModule,
    TypeOrmModule.forFeature([User, VerificationToken, Address, Phone]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get("JWT_SECRET"),
          signOptions: {
            expiresIn: '2m'
          }
        }
      }
    })
  ],


  exports: [TypeOrmModule, JwtStrategy, PassportModule, JwtModule]
})
export class AuthModule { }
