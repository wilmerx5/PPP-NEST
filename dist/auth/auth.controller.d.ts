import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { VerifyLogin2faDto } from './dto/verify-login-2fa.dto';
import { ValidRoles } from './interfaces/valid.roles.interface';
export declare class AuthController {
    private readonly authService;
    private readonly cookieService;
    constructor(authService: AuthService, cookieService: CookieService);
    signUp(createUserDto: CreateUserDTO): Promise<{
        msg: string;
    } | undefined>;
    login(loginDto: LogInUserDTO, res: Response): Promise<Response<any, Record<string, any>>>;
    login2fa(dto: VerifyLogin2faDto, res: Response): Promise<Response<any, Record<string, any>>>;
    get2faStatus(req: Request): {
        enabled: boolean;
        isStaff: boolean;
    };
    setup2fa(req: Request): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    confirm2fa(req: Request, dto: Confirm2faDto): Promise<{
        enabled: boolean;
        userId: string;
        email: string;
        fullName: string;
        recoveryCodes: string[];
        message: string;
    }>;
    disable2fa(req: Request, dto: Disable2faDto): Promise<{
        enabled: boolean;
        message: string;
    }>;
    reveal2fa(req: Request, dto: Confirm2faDto): Promise<{
        userId: string;
        email: string;
        fullName: string;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
        message: string;
    }>;
    refresh(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    logout(res: Response): Promise<Response<any, Record<string, any>>>;
    activateUser(validateTokenDTO: ValidateTokenDTO): Promise<{
        message: string;
    }>;
    newCode(requestNewCodeDTO: RequestNewCodeDTO): Promise<{
        message: string;
        email: string;
    }>;
    resendActivationLink(requestNewCodeDTO: RequestNewCodeDTO): Promise<{
        message: string;
    }>;
    validateToken(validateTokenDTO: ValidateTokenDTO): Promise<boolean>;
    testingPrivate(): {
        private: string;
    };
    roles(): Promise<ValidRoles[]>;
    getUser(req: any): any;
    requestPasswordReset(requestPasswordResetDTO: RequestPasswordResetDTO): Promise<{
        message: string;
    }>;
    resetPassword(resetPasswordDTO: ResetPasswordDTO): Promise<{
        message: string;
    }>;
    googleAuth(req: Request): Promise<void>;
    googleAuthRedirect(req: Request, res: Response): Promise<void>;
    googleFinalize(body: {
        accessToken: string;
        refreshToken: string;
    }, res: Response): Promise<Response<any, Record<string, any>>>;
}
