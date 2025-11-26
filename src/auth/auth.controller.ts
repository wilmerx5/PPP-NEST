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
import { User } from './entities/user.entity';

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
  @ApiOperation({ summary: 'Login user and set authentication cookies' })
  @ApiBody({ type: LogInUserDTO })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive user' })
  async login(@Body() loginDto: LogInUserDTO, @Res() res: Response) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    this.cookieService.setAccessToken(res, accessToken);
    this.cookieService.setRefreshToken(res, refreshToken);

    return res.json({
      message: 'Logged in successfully',
      user,
    });
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
  async roles() {

    return this.authService.getRoles();
  }


  @Get("user")
  @Auth()
  getUser(@Req() req) {
    return req.user;
  }

}
