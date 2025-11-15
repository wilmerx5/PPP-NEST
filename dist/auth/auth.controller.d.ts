import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { User } from './entities/user.entity';
export declare class AuthController {
    private readonly authService;
    private readonly cookieService;
    constructor(authService: AuthService, cookieService: CookieService);
    signUp(createUserDto: CreateUserDTO): Promise<{
        accessToken: string;
        refreshToken: string;
        user: User;
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
    validateToken(validateTokenDTO: ValidateTokenDTO): Promise<boolean>;
    testingPrivate(): {
        private: string;
    };
}
