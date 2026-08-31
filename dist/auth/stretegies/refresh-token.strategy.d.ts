import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
declare const RefreshTokenStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class RefreshTokenStrategy extends RefreshTokenStrategy_base {
    private readonly config;
    private readonly userRepository;
    constructor(config: ConfigService, userRepository: Repository<User>);
    validate(payload: JwtPayload): Promise<User>;
}
export {};
