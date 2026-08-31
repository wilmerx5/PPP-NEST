import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/common/mail/mail.service';
import { Repository } from 'typeorm';
import { CreateUserDTO } from './dto/create-user-dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { VerifyLogin2faDto } from './dto/verify-login-2fa.dto';
import { User } from './entities/user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ValidRoles } from './interfaces/valid.roles.interface';
import { TotpService } from './services/totp.service';
export declare class AuthService {
    private readonly userRepository;
    private readonly verificationTokenRepository;
    private readonly jwtService;
    private readonly mailService;
    private readonly totpService;
    private readonly configService;
    constructor(userRepository: Repository<User>, verificationTokenRepository: Repository<VerificationToken>, jwtService: JwtService, mailService: MailService, totpService: TotpService, configService: ConfigService);
    refreshTokens(userId: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    login(logInUserDTO: LogInUserDTO): Promise<{
        requires2FA: true;
        tempToken: string;
        user: {
            id: string;
            email: string;
            fullName: string;
        };
    } | {
        user: User;
        accessToken: string;
        refreshToken: string;
        requires2FA: false;
        tempToken?: undefined;
    }>;
    verifyLogin2fa(dto: VerifyLogin2faDto): Promise<{
        user: {
            id: string;
            email: string;
            password: string;
            fullName: string;
            isActive: boolean;
            phone: string;
            googleId: string;
            provider: string;
            roles: string[];
            totpEnabled: boolean;
            createdAt: Date;
            verificationTokens: VerificationToken[];
            addresses: import("./entities/address.entity").Address[];
            phones: import("./entities/phone.entity").Phone[];
        };
        accessToken: string;
        refreshToken: string;
    }>;
    get2faStatus(user: User): {
        enabled: boolean;
        isStaff: boolean;
    };
    private getStaffUserOrThrow;
    setup2fa(userId: string): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    adminSetupStaff2fa(staffId: string): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    private setup2faForUser;
    confirm2fa(userId: string, dto: Confirm2faDto): Promise<{
        enabled: boolean;
        userId: string;
        email: string;
        fullName: string;
        recoveryCodes: string[];
        message: string;
    }>;
    adminConfirmStaff2fa(staffId: string, dto: Confirm2faDto): Promise<{
        enabled: boolean;
        userId: string;
        email: string;
        fullName: string;
        recoveryCodes: string[];
        message: string;
    }>;
    reveal2fa(userId: string, dto: Confirm2faDto): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    adminRevealStaff2fa(staffId: string, dto: Confirm2faDto): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    private reveal2faForUser;
    private confirm2faForUser;
    disable2fa(userId: string, dto: Disable2faDto): Promise<{
        enabled: boolean;
        message: string;
    }>;
    adminDisableStaff2fa(staffId: string): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            totpEnabled: boolean;
        };
    }>;
    adminResetStaff2fa(staffId: string): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            totpEnabled: boolean;
        };
    }>;
    getJwtTokens(payload: JwtPayload): {
        accessToken: string;
        refreshToken: string;
    };
    private parseMs;
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
    }>;
    activateUser(validateTokenDTO: ValidateTokenDTO): Promise<{
        message: string;
    }>;
    validateToken(validateTokenDTO: ValidateTokenDTO): Promise<boolean>;
    private handleDBErrors;
    getRoles(): ValidRoles[];
    requestPasswordReset(requestPasswordResetDTO: RequestPasswordResetDTO): Promise<{
        message: string;
    }>;
    resetPassword(resetPasswordDTO: ResetPasswordDTO): Promise<{
        message: string;
    }>;
    createStaffUser(dto: CreateStaffUserDto): Promise<{
        success: boolean;
        message: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
            isActive: boolean;
            roles: string[];
            createdAt: Date;
        };
    } | undefined>;
    updateStaffUser(id: string, dto: UpdateStaffUserDto): Promise<{
        success: boolean;
        message: string;
        user: User | null;
    }>;
}
