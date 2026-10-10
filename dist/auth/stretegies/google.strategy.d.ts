import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-google-oauth20';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
declare const GoogleStrategy_base: new (...args: [options: import("passport-google-oauth20").StrategyOptionsWithRequest] | [options: import("passport-google-oauth20").StrategyOptions] | [options: import("passport-google-oauth20").StrategyOptions] | [options: import("passport-google-oauth20").StrategyOptionsWithRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class GoogleStrategy extends GoogleStrategy_base {
    private readonly userRepository;
    private readonly configService;
    constructor(userRepository: Repository<User>, configService: ConfigService);
    validate(accessToken: string, refreshToken: string, profile: any): Promise<User>;
}
export {};
