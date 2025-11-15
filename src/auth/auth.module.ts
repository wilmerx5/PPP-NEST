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
import { JwtStrategy } from './stretegies/jwt.strategy';
import { RefreshTokenStrategy } from './stretegies/refresh-token.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenStrategy,CookieService],
  imports: [
    CommonModule,
    ConfigModule,
    TypeOrmModule.forFeature([User, VerificationToken]),
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


  exports: [TypeOrmModule, JwtStrategy,PassportModule,JwtModule]
})
export class AuthModule { }
