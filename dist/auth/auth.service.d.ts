import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/common/mail/mail.service';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './interfaces/valid.roles.interface';
export declare class AuthService {
    private readonly userRepository;
    private readonly verificationTokenRepository;
    private readonly jwtService;
    private readonly mailService;
    constructor(userRepository: Repository<User>, verificationTokenRepository: Repository<VerificationToken>, jwtService: JwtService, mailService: MailService);
    refreshTokens(userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    login(logInUserDTO: LogInUserDTO): Promise<{
        user: User;
        accessToken: string;
        refreshToken: string;
    }>;
    getJwtTokens(payload: JwtPayload): {
        accessToken: string;
        refreshToken: string;
    };
    create(createUserDto: CreateUserDTO): Promise<{
        msg: string;
    } | undefined>;
    createUserActivationFlow(user: User): Promise<void>;
    generateAndStoreToken(user: User, type?: string): Promise<string>;
    generateTokenForUser(user: User): Promise<string>;
    requestNewCode(requestNewCodeDTO: RequestNewCodeDTO): Promise<{
        message: string;
        email: string;
    }>;
    resendActivationLink(requestNewCodeDTO: RequestNewCodeDTO): Promise<{
        message: string;
        email?: undefined;
    } | {
        message: string;
        email: string;
    }>;
    activateUser(validateTokenDTO: ValidateTokenDTO): Promise<{
        message: string;
    }>;
    validateToken(validateTokenDTO: ValidateTokenDTO): Promise<boolean>;
    private handleDBErrors;
    getRoles(): ValidRoles[];
    requestPasswordReset(requestPasswordResetDTO: RequestPasswordResetDTO): Promise<{
        message: string;
        email?: undefined;
    } | {
        message: string;
        email: string;
    }>;
    resetPassword(resetPasswordDTO: ResetPasswordDTO): Promise<{
        message: string;
    }>;
}
