import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    private readonly cookieService;
    constructor(authService: AuthService, cookieService: CookieService);
    signUp(createUserDto: CreateUserDTO): Promise<{
        msg: string;
    } | undefined>;
    login(loginDto: LogInUserDTO, res: Response): Promise<Response<any, Record<string, any>>>;
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
    roles(): Promise<import("./interfaces/valid.roles.interface").ValidRoles[]>;
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
