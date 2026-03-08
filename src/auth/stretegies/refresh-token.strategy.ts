import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private readonly config: ConfigService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => req?.cookies?.refresh_token
            ]),
            secretOrKey: config.get('JWT_SECRET')!,
        });
    }

    async validate(payload: JwtPayload) {
        const { id } = payload;
        const user = await this.userRepository.findOneBy({ id });
        if (!user) throw new UnauthorizedException('Token inválido');
        if (!user.isActive) throw new UnauthorizedException('Usuario no activo');

        return user;
    }
}
