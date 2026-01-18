"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const cookie_service_1 = require("./cookie.service");
const auth_decorator_1 = require("./decorators/auth.decorator");
const create_user_dto_1 = require("./dto/create-user-dto");
const login_user_dto_1 = require("./dto/login-user.dto");
const request_new_code_dto_1 = require("./dto/request-new-code.dto");
const validate_token_dto_1 = require("./dto/validate-token.dto");
const request_password_reset_dto_1 = require("./dto/request-password-reset.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
let AuthController = class AuthController {
    authService;
    cookieService;
    constructor(authService, cookieService) {
        this.authService = authService;
        this.cookieService = cookieService;
    }
    signUp(createUserDto) {
        return this.authService.create(createUserDto);
    }
    async login(loginDto, res) {
        const { accessToken, refreshToken, user } = await this.authService.login(loginDto);
        this.cookieService.setAccessToken(res, accessToken);
        this.cookieService.setRefreshToken(res, refreshToken);
        return res.json({
            message: 'Logged in successfully',
            user,
        });
    }
    async refresh(req, res) {
        const user = req.user;
        const { accessToken, refreshToken } = await this.authService.refreshTokens(user.id);
        this.cookieService.setAccessToken(res, accessToken);
        this.cookieService.setRefreshToken(res, refreshToken);
        return res.json({
            message: 'Tokens refreshed',
        });
    }
    async logout(res) {
        this.cookieService.clearAuthCookies(res);
        return res.json({
            message: 'Logged out successfully',
        });
    }
    async activateUser(validateTokenDTO) {
        return this.authService.activateUser(validateTokenDTO);
    }
    async newCode(requestNewCodeDTO) {
        return this.authService.requestNewCode(requestNewCodeDTO);
    }
    async resendActivationLink(requestNewCodeDTO) {
        return this.authService.resendActivationLink(requestNewCodeDTO);
    }
    async validateToken(validateTokenDTO) {
        return this.authService.validateToken(validateTokenDTO);
    }
    testingPrivate() {
        return {
            private: 'private',
        };
    }
    async roles() {
        return this.authService.getRoles();
    }
    getUser(req) {
        return req.user;
    }
    async requestPasswordReset(requestPasswordResetDTO) {
        return this.authService.requestPasswordReset(requestPasswordResetDTO);
    }
    async resetPassword(resetPasswordDTO) {
        return this.authService.resetPassword(resetPasswordDTO);
    }
    async googleAuth(req) {
        throw new Error('Google OAuth is not configured correctly - Guard did not intercept the request');
    }
    async googleAuthRedirect(req, res) {
        const user = req.user;
        const { accessToken, refreshToken } = await this.authService.getJwtTokens({ id: user.id });
        const authFrontendUrl = process.env.AUTH_FRONTEND_URL || 'http://auth.ppp.local:5174/logged-in';
        const redirectUrl = `${authFrontendUrl}?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}`;
        return res.redirect(redirectUrl);
    }
    async googleFinalize(body, res) {
        const { accessToken, refreshToken } = body;
        this.cookieService.setAccessToken(res, accessToken);
        this.cookieService.setRefreshToken(res, refreshToken);
        return res.json({
            message: 'Cookies set successfully',
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('signup'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }),
    (0, swagger_1.ApiBody)({ type: create_user_dto_1.CreateUserDTO }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'User created and activation email sent',
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation error' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDTO]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "signUp", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({ summary: 'Login user and set authentication cookies' }),
    (0, swagger_1.ApiBody)({ type: login_user_dto_1.LogInUserDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Logged in successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials or inactive user' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_user_dto_1.LogInUserDTO, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt-refresh')),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access and refresh tokens' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tokens refreshed correctly' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiOperation)({ summary: 'Logout user by clearing cookies' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Logged out successfully' }),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('activate-user'),
    (0, swagger_1.ApiOperation)({ summary: 'Activate user account using token and userId' }),
    (0, swagger_1.ApiBody)({ type: validate_token_dto_1.ValidateTokenDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User activated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid or expired token' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [validate_token_dto_1.ValidateTokenDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "activateUser", null);
__decorate([
    (0, common_1.Post)('new-code'),
    (0, swagger_1.ApiOperation)({ summary: 'Send a new verification code to a registered email' }),
    (0, swagger_1.ApiBody)({ type: request_new_code_dto_1.RequestNewCodeDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification code sent' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Email not registered' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_new_code_dto_1.RequestNewCodeDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "newCode", null);
__decorate([
    (0, common_1.Post)('resend-activation-link'),
    (0, swagger_1.ApiOperation)({ summary: 'Resend activation link to a registered email' }),
    (0, swagger_1.ApiBody)({ type: request_new_code_dto_1.RequestNewCodeDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Activation link sent (if email exists and account is inactive)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation error' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_new_code_dto_1.RequestNewCodeDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendActivationLink", null);
__decorate([
    (0, common_1.Post)('validate-token'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a verification token' }),
    (0, swagger_1.ApiBody)({ type: validate_token_dto_1.ValidateTokenDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token valid' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Token invalid or expired' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [validate_token_dto_1.ValidateTokenDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "validateToken", null);
__decorate([
    (0, common_1.Get)('private'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Private route (requires JWT access token)' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Access granted' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "testingPrivate", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, swagger_1.ApiOperation)({ summary: 'Return all allowed roles' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'all roles' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'roles',
        content: {
            'application/json': {
                example: {
                    roles: ['user'],
                }
            }
        }
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "roles", null);
__decorate([
    (0, common_1.Get)('user'),
    (0, auth_decorator_1.Auth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Return authenticated user information' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized: invalid or expired token' }),
    (0, swagger_1.ApiResponse)({
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
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getUser", null);
__decorate([
    (0, common_1.Post)('request-password-reset'),
    (0, swagger_1.ApiOperation)({ summary: 'Request a password reset code via email' }),
    (0, swagger_1.ApiBody)({ type: request_password_reset_dto_1.RequestPasswordResetDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset code sent (if email exists)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation error' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_password_reset_dto_1.RequestPasswordResetDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "requestPasswordReset", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, swagger_1.ApiOperation)({ summary: 'Reset password using verification code' }),
    (0, swagger_1.ApiBody)({ type: reset_password_dto_1.ResetPasswordDTO }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid code, expired code, or validation error' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDTO]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    (0, swagger_1.ApiOperation)({ summary: 'Iniciar autenticación con Google' }),
    (0, swagger_1.ApiResponse)({ status: 302, description: 'Redirige a Google OAuth' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('google')),
    (0, swagger_1.ApiOperation)({ summary: 'Callback de Google OAuth' }),
    (0, swagger_1.ApiResponse)({ status: 302, description: 'Redirige al frontend con tokens en URL' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthRedirect", null);
__decorate([
    (0, common_1.Post)('google/finalize'),
    (0, swagger_1.ApiOperation)({ summary: 'Establece cookies después de Google OAuth' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cookies establecidas correctamente' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleFinalize", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        cookie_service_1.CookieService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map