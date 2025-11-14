import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { User } from './entities/user.entity';
export declare class AuthService {
    private readonly userRepository;
    private readonly jwtService;
    constructor(userRepository: Repository<User>, jwtService: JwtService);
    refreshTokens(userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    login(logInUserDTO: LogInUserDTO): Promise<{
        user: User;
        accessToken: string;
        refreshToken: string;
    }>;
    private getTokens;
    create(createUserDto: CreateUserDTO): Promise<{
        accessToken: string;
        refreshToken: string;
        user: User;
    } | undefined>;
    private handleDBErrors;
}
