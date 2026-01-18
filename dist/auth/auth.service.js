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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = require("bcrypt");
const mail_service_1 = require("../common/mail/mail.service");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const verification_token_entity_1 = require("./entities/verification-token.entity");
const valid_roles_interface_1 = require("./interfaces/valid.roles.interface");
let AuthService = class AuthService {
    userRepository;
    verificationTokenRepository;
    jwtService;
    mailService;
    constructor(userRepository, verificationTokenRepository, jwtService, mailService) {
        this.userRepository = userRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.jwtService = jwtService;
        this.mailService = mailService;
    }
    async refreshTokens(userId) {
        const payload = { id: userId };
        return this.getJwtTokens(payload);
    }
    async login(logInUserDTO) {
        const { password, email } = logInUserDTO;
        const user = await this.userRepository.findOne({ where: { email }, select: { email: true, password: true, id: true, isActive: true } });
        if (!user)
            throw new common_1.UnauthorizedException("invalid credential");
        if (!bcrypt.compareSync(password, user.password))
            throw new common_1.UnauthorizedException("invalid credential");
        if (!user.isActive)
            throw new common_1.UnauthorizedException("Inactive User, pleas active your user");
        const tokens = this.getJwtTokens({ id: user.id });
        return { ...tokens, user };
    }
    getJwtTokens(payload) {
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '15m',
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: '7d',
        });
        return { accessToken, refreshToken };
    }
    async create(createUserDto) {
        try {
            const { password, ...rest } = createUserDto;
            const user = this.userRepository.create({
                ...rest,
                password: bcrypt.hashSync(password, 10),
                isActive: false,
            });
            await this.userRepository.save(user);
            await this.createUserActivationFlow(user);
            return {
                msg: 'Usuario creado con exito, revisa tu email y activa tu cuent'
            };
        }
        catch (e) {
            this.handleDBErrors(e);
        }
    }
    async createUserActivationFlow(user) {
        const token = await this.generateAndStoreToken(user);
        await this.mailService.sendActivateUser(user.email, user.id, token);
    }
    async generateAndStoreToken(user, type = 'activation') {
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        console.log(`[GENERATE TOKEN] Generando token para usuario: ${user.id}, tipo: ${type}`);
        console.log(`[GENERATE TOKEN] Token generado: ${token}`);
        console.log(`[GENERATE TOKEN] Fecha expiración: ${expiresAt.toISOString()}`);
        const emailToken = this.verificationTokenRepository.create({
            token,
            expiresAt,
            user,
            type,
        });
        const savedToken = await this.verificationTokenRepository.save(emailToken);
        console.log(`[GENERATE TOKEN] ✅ Token guardado correctamente. ID: ${savedToken.id}, tipo: ${savedToken.type}`);
        return token;
    }
    async generateTokenForUser(user) {
        const token = await this.generateAndStoreToken(user);
        await this.mailService.sendVerificationCode(user.email, token);
        return token;
    }
    async requestNewCode(requestNewCodeDTO) {
        const { email } = requestNewCodeDTO;
        const user = await this.userRepository.findOne({
            where: { email },
        });
        if (!user) {
            throw new common_1.BadRequestException('Email not registered');
        }
        await this.verificationTokenRepository.update({ user: { id: user.id }, type: 'activation', isUsed: false }, { isUsed: true });
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        const newToken = this.verificationTokenRepository.create({
            token,
            expiresAt,
            user,
            type: 'activation',
        });
        await this.verificationTokenRepository.save(newToken);
        await this.mailService.sendVerificationCode(email, token);
        return {
            message: 'A new verification code has been sent',
            email,
        };
    }
    async resendActivationLink(requestNewCodeDTO) {
        const { email } = requestNewCodeDTO;
        console.log('[RESEND ACTIVATION LINK] Solicitando reenvío de link para:', email);
        const user = await this.userRepository.findOne({
            where: { email },
            select: { id: true, email: true, isActive: true },
        });
        if (!user) {
            console.log('[RESEND ACTIVATION LINK] ❌ Usuario no encontrado');
            return {
                message: 'Si el email existe y la cuenta no está activa, se enviará un nuevo link de activación',
            };
        }
        console.log('[RESEND ACTIVATION LINK] ✅ Usuario encontrado. ID:', user.id, 'Activo:', user.isActive);
        if (user.isActive) {
            console.log('[RESEND ACTIVATION LINK] ⚠️ Usuario ya está activo');
            return {
                message: 'Esta cuenta ya está activa',
            };
        }
        await this.verificationTokenRepository.update({ user: { id: user.id }, type: 'activation', isUsed: false }, { isUsed: true });
        console.log('[RESEND ACTIVATION LINK] Tokens previos invalidados');
        const token = await this.generateAndStoreToken(user, 'activation');
        console.log('[RESEND ACTIVATION LINK] ✅ Nuevo token generado:', token);
        await this.mailService.sendActivateUser(user.email, user.id, token);
        console.log('[RESEND ACTIVATION LINK] ✅ Link de activación enviado');
        return {
            message: 'Si el email existe y la cuenta no está activa, se enviará un nuevo link de activación',
            email,
        };
    }
    async activateUser(validateTokenDTO) {
        const { idUser } = validateTokenDTO;
        await this.validateToken(validateTokenDTO);
        const user = await this.userRepository.findOneBy({ id: idUser });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        user.isActive = true;
        await this.userRepository.save(user);
        return {
            message: 'Usuario activado correctamente'
        };
    }
    async validateToken(validateTokenDTO) {
        const { idUser, otp } = validateTokenDTO;
        const token = await this.verificationTokenRepository.findOne({
            where: { user: { id: idUser }, token: otp, type: 'activation', isUsed: false },
        });
        console.log(token);
        if (!token)
            throw new common_1.BadRequestException('Token inválido');
        if (token.expiresAt < new Date())
            throw new common_1.BadRequestException('Token expirado');
        token.isUsed = true;
        await this.verificationTokenRepository.save(token);
        return true;
    }
    handleDBErrors(e) {
        if (e.errno = 1062) {
            throw new common_1.BadRequestException(e.sqlMessage);
        }
        throw new common_1.InternalServerErrorException(e);
    }
    getRoles() {
        return Object.values(valid_roles_interface_1.ValidRoles);
    }
    async requestPasswordReset(requestPasswordResetDTO) {
        const { email } = requestPasswordResetDTO;
        console.log('[PASSWORD RESET REQUEST] Solicitando reset para email:', email);
        const user = await this.userRepository.findOne({
            where: { email },
        });
        if (!user) {
            console.log('[PASSWORD RESET REQUEST] ❌ Usuario no encontrado');
            return {
                message: 'Si el email existe, se enviará un código de recuperación',
            };
        }
        console.log('[PASSWORD RESET REQUEST] ✅ Usuario encontrado. ID:', user.id);
        const invalidatedTokens = await this.verificationTokenRepository.update({ user: { id: user.id }, type: 'password-reset', isUsed: false }, { isUsed: true });
        console.log('[PASSWORD RESET REQUEST] Tokens previos invalidados:', invalidatedTokens.affected);
        const token = await this.generateAndStoreToken(user, 'password-reset');
        console.log('[PASSWORD RESET REQUEST] ✅ Token generado:', token);
        await this.mailService.sendPasswordResetCode(email, token);
        console.log('[PASSWORD RESET REQUEST] ✅ Email enviado correctamente');
        return {
            message: 'Si el email existe, se enviará un código de recuperación',
            email,
        };
    }
    async resetPassword(resetPasswordDTO) {
        const { email, code, newPassword } = resetPasswordDTO;
        console.log('[PASSWORD RESET] Iniciando reset de contraseña');
        console.log('[PASSWORD RESET] Email:', email);
        console.log('[PASSWORD RESET] Código recibido:', code);
        console.log('[PASSWORD RESET] Longitud del código:', code?.length);
        const user = await this.userRepository.findOne({
            where: { email },
            select: { id: true, email: true, password: true },
        });
        if (!user) {
            console.log('[PASSWORD RESET] ❌ Usuario no encontrado para email:', email);
            throw new common_1.BadRequestException('Email no encontrado');
        }
        console.log('[PASSWORD RESET] ✅ Usuario encontrado. ID:', user.id);
        console.log('[PASSWORD RESET] Buscando token con:');
        console.log('  - userId:', user.id);
        console.log('  - token:', code);
        console.log('  - type: password-reset');
        console.log('  - isUsed: false');
        const token = await this.verificationTokenRepository.findOne({
            where: {
                user: { id: user.id },
                token: code,
                type: 'password-reset',
                isUsed: false
            },
        });
        if (!token) {
            console.log('[PASSWORD RESET] ❌ Token no encontrado');
            const allTokens = await this.verificationTokenRepository.find({
                where: { user: { id: user.id }, type: 'password-reset' },
                order: { createdAt: 'DESC' },
                take: 5,
            });
            console.log('[PASSWORD RESET] Tokens encontrados para este usuario (últimos 5):');
            allTokens.forEach((t, idx) => {
                console.log(`  Token ${idx + 1}:`, {
                    token: t.token,
                    type: t.type,
                    isUsed: t.isUsed,
                    expiresAt: t.expiresAt,
                    createdAt: t.createdAt,
                    expired: t.expiresAt < new Date(),
                });
            });
            const tokenByCode = await this.verificationTokenRepository.findOne({
                where: { user: { id: user.id }, token: code, type: 'password-reset' },
            });
            if (tokenByCode) {
                if (tokenByCode.isUsed) {
                    console.log('[PASSWORD RESET] ⚠️ Token encontrado pero ya fue usado');
                    throw new common_1.BadRequestException('Este código ya fue utilizado. Solicita un nuevo código.');
                }
                if (tokenByCode.expiresAt < new Date()) {
                    console.log('[PASSWORD RESET] ⚠️ Token encontrado pero expiró');
                    throw new common_1.BadRequestException('Código expirado. Solicita un nuevo código.');
                }
            }
            throw new common_1.BadRequestException('Código inválido');
        }
        console.log('[PASSWORD RESET] ✅ Token encontrado:', {
            id: token.id,
            token: token.token,
            expiresAt: token.expiresAt,
            isUsed: token.isUsed,
        });
        if (token.expiresAt < new Date()) {
            console.log('[PASSWORD RESET] ❌ Token expirado. Fecha expiración:', token.expiresAt);
            throw new common_1.BadRequestException('Código expirado');
        }
        console.log('[PASSWORD RESET] Token válido, procediendo a actualizar contraseña');
        token.isUsed = true;
        await this.verificationTokenRepository.save(token);
        console.log('[PASSWORD RESET] ✅ Token marcado como usado');
        user.password = bcrypt.hashSync(newPassword, 10);
        await this.userRepository.save(user);
        console.log('[PASSWORD RESET] ✅ Contraseña actualizada correctamente');
        return {
            message: 'Contraseña actualizada correctamente',
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(verification_token_entity_1.VerificationToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map