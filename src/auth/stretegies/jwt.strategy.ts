import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(@InjectRepository(User) private readonly userRepository: Repository<User>,
        configService: ConfigService
    ) {

        super({
            secretOrKey: configService.get("JWT_SECRET")!,
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: any) => {
                    return req?.cookies?.access_token;
                }
            ]),
        })
    }

    async validate(payload: JwtPayload): Promise<User> {
        if (payload?.purpose === '2fa') {
            throw new UnauthorizedException('Completa la verificación 2FA');
        }

        const { id } = payload

        const user = await this.userRepository.findOneBy({ id })
        if (!user) throw new UnauthorizedException('Token inválido')
        if (!user.isActive) throw new UnauthorizedException('Usuario no activo')

        return user;
    }
}
