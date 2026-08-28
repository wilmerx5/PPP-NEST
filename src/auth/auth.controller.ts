import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { Auth } from './decorators/auth.decorator';
import { CreateUserDTO } from './dto/create-user-dto';
import { LogInUserDTO } from './dto/login-user.dto';
import { RequestNewCodeDTO } from './dto/request-new-code.dto';
import { ValidateTokenDTO } from './dto/validate-token.dto';
import { RequestPasswordResetDTO } from './dto/request-password-reset.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { VerifyLogin2faDto } from './dto/verify-login-2fa.dto';
import { User } from './entities/user.entity';
import { formatToBogotaISO } from '../common/utils/date.util';
import { ValidRoles } from './interfaces/valid.roles.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) { }

  // -------------------------------------------------------------
  // SIGNUP
  // -------------------------------------------------------------
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: CreateUserDTO })
  @ApiResponse({
    status: 201,
    description: 'User created and activation email sent',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  signUp(@Body() createUserDto: CreateUserDTO) {
    return this.authService.create(createUserDto);
  }

  // -------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------
  @Post('login')
  @ApiOperation({ summary: 'Login user and set authentication cookies (or request 2FA)' })
  @ApiBody({ type: LogInUserDTO })
  @ApiResponse({ status: 200, description: 'Logged in successfully or 2FA required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive user' })
  async login(@Body() loginDto: LogInUserDTO, @Res() res: Response) {
    const result = await this.authService.login(loginDto);

    if (result.requires2FA) {
      return res.json({
        requires2FA: true,
        tempToken: result.tempToken,
        message: 'Ingresa el código de tu app authenticator',
        user: result.user,
      });
    }

    this.cookieService.setAccessToken(res, result.accessToken);
    this.cookieService.setRefreshToken(res, result.refreshToken);

    return res.json({
      requires2FA: false,
      message: 'Logged in successfully',
      user: result.user,
    });
  }

  @Post('login/2fa')
  @ApiOperation({ summary: 'Complete login with TOTP or recovery code' })
  @ApiBody({ type: VerifyLogin2faDto })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code or expired temp token' })
  async login2fa(@Body() dto: VerifyLogin2faDto, @Res() res: Response) {
    const { accessToken, refreshToken, user } =
      await this.authService.verifyLogin2fa(dto);

    this.cookieService.setAccessToken(res, accessToken);
    this.cookieService.setRefreshToken(res, refreshToken);

    return res.json({
      message: 'Logged in successfully',
      user,
    });
  }

  @Get('2fa/status')
  @Auth(
    ValidRoles.admin,
    ValidRoles.kitchenUser,
    ValidRoles.tableUser,
    ValidRoles.ordersUser,
    ValidRoles.whatsappUser,
  )
  @ApiOperation({ summary: 'Estado de 2FA del usuario autenticado' })
  get2faStatus(@Req() req: Request) {
    return this.authService.get2faStatus(req.user as User);
  }

  @Post('2fa/setup')
  @Auth(
    ValidRoles.admin,
    ValidRoles.kitchenUser,
    ValidRoles.tableUser,
    ValidRoles.ordersUser,
    ValidRoles.whatsappUser,
  )
  @ApiOperation({ summary: 'Iniciar setup TOTP (QR + secreto)' })
  setup2fa(@Req() req: Request) {
    return this.authService.setup2fa((req.user as User).id);
  }

  @Post('2fa/confirm')
  @Auth(
    ValidRoles.admin,
    ValidRoles.kitchenUser,
    ValidRoles.tableUser,
    ValidRoles.ordersUser,
    ValidRoles.whatsappUser,
  )
  @ApiOperation({ summary: 'Confirmar setup TOTP y obtener códigos de recuperación' })
  @ApiBody({ type: Confirm2faDto })
  confirm2fa(@Req() req: Request, @Body() dto: Confirm2faDto) {
    return this.authService.confirm2fa((req.user as User).id, dto);
  }

  @Post('2fa/disable')
  @Auth(
    ValidRoles.admin,
    ValidRoles.kitchenUser,
    ValidRoles.tableUser,
    ValidRoles.ordersUser,
    ValidRoles.whatsappUser,
  )
  @ApiOperation({ summary: 'Desactivar 2FA con código TOTP o de recuperación' })
  @ApiBody({ type: Disable2faDto })
  disable2fa(@Req() req: Request, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa((req.user as User).id, dto);
  }

  // -------------------------------------------------------------
  // REFRESH TOKENS
  // -------------------------------------------------------------
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Tokens refreshed correctly' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;

    const { accessToken, refreshToken } =
      await this.authService.refreshTokens(user.id);

    this.cookieService.setAccessToken(res, accessToken);
    this.cookieService.setRefreshToken(res, refreshToken);

    return res.json({
      message: 'Tokens refreshed',
    });
  }

  // -------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------
  @Post('logout')
  @ApiOperation({ summary: 'Logout user by clearing cookies' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Res() res: Response) {
    this.cookieService.clearAuthCookies(res);

    return res.json({
      message: 'Logged out successfully',
    });
  }

  // -------------------------------------------------------------
  // ACTIVATE USER
  // -------------------------------------------------------------
  @Post('activate-user')
  @ApiOperation({ summary: 'Activate user account using token and userId' })
  @ApiBody({ type: ValidateTokenDTO })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async activateUser(@Body() validateTokenDTO: ValidateTokenDTO) {
    return this.authService.activateUser(validateTokenDTO);
  }

  // -------------------------------------------------------------
  // NEW CODE
  // -------------------------------------------------------------
  @Post('new-code')
  @ApiOperation({ summary: 'Send a new verification code to a registered email' })
  @ApiBody({ type: RequestNewCodeDTO })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  @ApiResponse({ status: 400, description: 'Email not registered' })
  async newCode(@Body() requestNewCodeDTO: RequestNewCodeDTO) {
    return this.authService.requestNewCode(requestNewCodeDTO);
  }

  @Post('resend-activation-link')
  @ApiOperation({ summary: 'Resend activation link to a registered email' })
  @ApiBody({ type: RequestNewCodeDTO })
  @ApiResponse({ status: 200, description: 'Activation link sent (if email exists and account is inactive)' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async resendActivationLink(@Body() requestNewCodeDTO: RequestNewCodeDTO) {
    return this.authService.resendActivationLink(requestNewCodeDTO);
  }

  // -------------------------------------------------------------
  // VALIDATE TOKEN
  // -------------------------------------------------------------
  @Post('validate-token')
  @ApiOperation({ summary: 'Validate a verification token' })
  @ApiBody({ type: ValidateTokenDTO })
  @ApiResponse({ status: 200, description: 'Token valid' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  async validateToken(@Body() validateTokenDTO: ValidateTokenDTO) {
    return this.authService.validateToken(validateTokenDTO);
  }

  // -------------------------------------------------------------
  // PRIVATE ROUTE
  // -------------------------------------------------------------
  @Get('private')
  @Auth()
  @ApiOperation({ summary: 'Private route (requires JWT access token)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Access granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  testingPrivate() {
    return {
      private: 'private',
    };
  }


  @Get('roles')
  @ApiOperation({ summary: 'Return all allowed roles' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'all roles' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiResponse({
  status: 200,
  description: 'roles',
  content: {
    'application/json': {
      example: {
        roles: ['user'],

      }
    }
  }
})
  async roles() {

    return this.authService.getRoles();
  }



  @Get('user')
@Auth()
@ApiOperation({ summary: 'Return authenticated user information' })
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized: invalid or expired token' })
@ApiResponse({
  status: 200,
  description: 'Authenticated user data',
  content: {
    'application/json': {
      example: {
        id: 'f4cfbf37-5ac9-4834-8e67-ffac6b6f1eab',
        email: 'wilmercampos2004@gmail.com',
        fullName: 'Wilmer CAMPOS',
        isActive: true,
        phone: '3124547085',
        roles: ['user'],
        createdAt: '2025-11-26T07:57:58.612Z'
      }
    }
  }
})
getUser(@Req() req) {
  const user = req.user as any;
  // Convert createdAt to Bogotá timezone before sending to frontend
  if (user?.createdAt) {
    return {
      ...user,
      createdAt: formatToBogotaISO(user.createdAt),
    };
  }
  return user;
}

  // -------------------------------------------------------------
  // PASSWORD RESET
  // -------------------------------------------------------------

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request a password reset code via email' })
  @ApiBody({ type: RequestPasswordResetDTO })
  @ApiResponse({ status: 200, description: 'Password reset code sent (if email exists)' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async requestPasswordReset(@Body() requestPasswordResetDTO: RequestPasswordResetDTO) {
    return this.authService.requestPasswordReset(requestPasswordResetDTO);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using verification code' })
  @ApiBody({ type: ResetPasswordDTO })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code, expired code, or validation error' })
  async resetPassword(@Body() resetPasswordDTO: ResetPasswordDTO) {
    return this.authService.resetPassword(resetPasswordDTO);
  }

  // -------------------------------------------------------------
  // GOOGLE OAUTH
  // -------------------------------------------------------------

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar autenticación con Google' })
  @ApiResponse({ status: 302, description: 'Redirige a Google OAuth' })
  async googleAuth(@Req() req: Request) {
    // Passport handles the redirect automatically
    // This method should never execute because Passport intercepts before
    // and redirects directly to Google OAuth
    throw new Error('Google OAuth is not configured correctly - Guard did not intercept the request');
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  @ApiResponse({ status: 302, description: 'Redirige al frontend con tokens en URL' })
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    
    // Generate JWT tokens
    const { accessToken, refreshToken } = await this.authService.getJwtTokens({ id: user.id });
    
    // Do NOT set cookies here - browser blocks them in cross-site redirects
    // Instead, pass tokens as query params for the frontend to set them
    
    const authFrontendUrl = process.env.AUTH_FRONTEND_URL || 'http://auth.ppp.local:5174/logged-in';
    
    // Pass tokens as query params (temporary, frontend will call /auth/google/finalize)
    const redirectUrl = `${authFrontendUrl}?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}`;
    
    return res.redirect(redirectUrl);
  }

  @Post('google/finalize')
  @ApiOperation({ summary: 'Establece cookies después de Google OAuth' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cookies establecidas correctamente' })
  async googleFinalize(
    @Body() body: { accessToken: string; refreshToken: string },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = body;
    
    // Now set cookies (request comes from frontend, not from Google)
    this.cookieService.setAccessToken(res, accessToken);
    this.cookieService.setRefreshToken(res, refreshToken);
    
    return res.json({
      message: 'Cookies set successfully',
    });
  }

}
