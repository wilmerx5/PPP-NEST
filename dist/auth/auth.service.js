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
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = require("bcrypt");
const mail_service_1 = require("../common/mail/mail.service");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const verification_token_entity_1 = require("./entities/verification-token.entity");
const valid_roles_interface_1 = require("./interfaces/valid.roles.interface");
const staff_roles_util_1 = require("./staff.roles.util");
const totp_service_1 = require("./services/totp.service");
const DEFAULT_REFRESH_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
let AuthService = class AuthService {
    userRepository;
    verificationTokenRepository;
    jwtService;
    mailService;
    totpService;
    configService;
    constructor(userRepository, verificationTokenRepository, jwtService, mailService, totpService, configService) {
        this.userRepository = userRepository;
        this.verificationTokenRepository = verificationTokenRepository;
        this.jwtService = jwtService;
        this.mailService = mailService;
        this.totpService = totpService;
        this.configService = configService;
    }
    async refreshTokens(userId) {
        const payload = { id: userId };
        return this.getJwtTokens(payload);
    }
    async login(logInUserDTO) {
        const { password, email } = logInUserDTO;
        const user = await this.userRepository.findOne({
            where: { email },
            select: {
                email: true,
                password: true,
                id: true,
                isActive: true,
                provider: true,
                totpEnabled: true,
                roles: true,
                fullName: true,
            },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        if (user.provider === 'google' || user.password == null || user.password === '') {
            throw new common_1.UnauthorizedException('Esta cuenta se registró con Google. Inicia sesión usando el botón "Continuar con Google".');
        }
        if (!bcrypt.compareSync(password, user.password)) {
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        if (!user.isActive)
            throw new common_1.UnauthorizedException('Tu cuenta no está activa. Actívala desde el enlace que enviamos a tu correo.');
        if (user.totpEnabled) {
            const tempToken = this.jwtService.sign({ id: user.id, purpose: '2fa' }, { expiresIn: '5m' });
            return {
                requires2FA: true,
                tempToken,
                user: { id: user.id, email: user.email, fullName: user.fullName },
            };
        }
        const tokens = this.getJwtTokens({ id: user.id });
        return { requires2FA: false, ...tokens, user };
    }
    async verifyLogin2fa(dto) {
        let payload;
        try {
            payload = this.jwtService.verify(dto.tempToken);
        }
        catch {
            throw new common_1.UnauthorizedException('Sesión de verificación expirada. Vuelve a iniciar sesión.');
        }
        if (payload.purpose !== '2fa' || !payload.id) {
            throw new common_1.UnauthorizedException('Token de verificación inválido');
        }
        const user = await this.userRepository.findOne({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                totpEnabled: true,
                totpSecret: true,
                totpRecoveryCodes: true,
                roles: true,
            },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Usuario no disponible');
        }
        if (!user.totpEnabled || !user.totpSecret) {
            throw new common_1.BadRequestException('Este usuario no tiene 2FA activo');
        }
        const code = (dto.code || '').trim();
        let ok = this.totpService.verifyToken(user.totpSecret, code);
        if (!ok) {
            const remaining = this.totpService.consumeRecoveryCode(user.totpRecoveryCodes, code);
            if (remaining) {
                ok = true;
                await this.userRepository.update({ id: user.id }, { totpRecoveryCodes: remaining.length ? remaining : null });
            }
        }
        if (!ok) {
            throw new common_1.UnauthorizedException('Código 2FA inválido');
        }
        const { totpSecret: _s, totpRecoveryCodes: _r, ...safeUser } = user;
        const tokens = this.getJwtTokens({ id: user.id });
        return { ...tokens, user: safeUser };
    }
    get2faStatus(user) {
        return {
            enabled: Boolean(user.totpEnabled),
            isStaff: (0, staff_roles_util_1.userHasStaffRole)(user.roles),
        };
    }
    async getStaffUserOrThrow(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'email', 'fullName', 'roles', 'totpEnabled', 'totpSecret', 'totpRecoveryCodes'],
        });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        if (!(0, staff_roles_util_1.userHasStaffRole)(user.roles)) {
            throw new common_1.BadRequestException('Este usuario no es de staff interno');
        }
        return user;
    }
    async setup2fa(userId) {
        return this.setup2faForUser(userId);
    }
    async adminSetupStaff2fa(staffId) {
        return this.setup2faForUser(staffId, { forceRestart: true });
    }
    async setup2faForUser(userId, opts) {
        const user = await this.getStaffUserOrThrow(userId);
        if (user.totpEnabled && !opts?.forceRestart) {
            throw new common_1.BadRequestException('Ya tiene 2FA activo. Desactívalo primero para reconfigurarlo.');
        }
        const secret = this.totpService.createSecret();
        const otpauthUrl = this.totpService.buildOtpAuthUri(user.email, secret);
        const qrDataUrl = await this.totpService.buildQrDataUrl(otpauthUrl);
        await this.userRepository.update({ id: user.id }, { totpSecret: secret, totpEnabled: false, totpRecoveryCodes: null });
        return {
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            secret,
            otpauthUrl,
            qrDataUrl,
            message: 'Escanea el QR con la app authenticator del usuario y confirma con un código de 6 dígitos',
        };
    }
    async confirm2fa(userId, dto) {
        return this.confirm2faForUser(userId, dto);
    }
    async adminConfirmStaff2fa(staffId, dto) {
        return this.confirm2faForUser(staffId, dto);
    }
    async reveal2fa(userId, dto) {
        return this.reveal2faForUser(userId, dto);
    }
    async adminRevealStaff2fa(staffId, dto) {
        return this.reveal2faForUser(staffId, dto);
    }
    async reveal2faForUser(userId, dto) {
        const user = await this.getStaffUserOrThrow(userId);
        if (!user.totpEnabled || !user.totpSecret) {
            throw new common_1.BadRequestException('Este usuario no tiene 2FA activo');
        }
        if (!this.totpService.verifyToken(user.totpSecret, dto.code)) {
            throw new common_1.UnauthorizedException('Código inválido. Usa el código del teléfono que ya tiene 2FA.');
        }
        const otpauthUrl = this.totpService.buildOtpAuthUri(user.email, user.totpSecret);
        const qrDataUrl = await this.totpService.buildQrDataUrl(otpauthUrl);
        return {
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            secret: user.totpSecret,
            otpauthUrl,
            qrDataUrl,
            message: 'Escanea este QR en el teléfono nuevo. El actual sigue funcionando (mismo secreto).',
        };
    }
    async confirm2faForUser(userId, dto) {
        const user = await this.getStaffUserOrThrow(userId);
        if (user.totpEnabled) {
            throw new common_1.BadRequestException('El 2FA ya está activo');
        }
        if (!user.totpSecret) {
            throw new common_1.BadRequestException('Primero inicia la configuración de 2FA');
        }
        if (!this.totpService.verifyToken(user.totpSecret, dto.code)) {
            throw new common_1.BadRequestException('Código inválido. Revisa la hora del teléfono e inténtalo de nuevo.');
        }
        const recoveryCodes = this.totpService.generateRecoveryCodes();
        const hashed = this.totpService.hashRecoveryCodes(recoveryCodes);
        await this.userRepository.update({ id: user.id }, { totpEnabled: true, totpRecoveryCodes: hashed });
        return {
            enabled: true,
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            recoveryCodes,
            message: '2FA activado. Guarda estos códigos de recuperación; no se mostrarán otra vez.',
        };
    }
    async disable2fa(userId, dto) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'totpEnabled', 'totpSecret', 'totpRecoveryCodes'],
        });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        if (!user.totpEnabled || !user.totpSecret) {
            throw new common_1.BadRequestException('No tienes 2FA activo');
        }
        const code = (dto.code || '').trim();
        let ok = this.totpService.verifyToken(user.totpSecret, code);
        if (!ok) {
            const remaining = this.totpService.consumeRecoveryCode(user.totpRecoveryCodes, code);
            ok = Boolean(remaining);
        }
        if (!ok) {
            throw new common_1.UnauthorizedException('Código 2FA inválido');
        }
        await this.userRepository.update({ id: user.id }, { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null });
        return { enabled: false, message: '2FA desactivado' };
    }
    async adminDisableStaff2fa(staffId) {
        return this.adminResetStaff2fa(staffId);
    }
    async adminResetStaff2fa(staffId) {
        const user = await this.getStaffUserOrThrow(staffId);
        await this.userRepository.update({ id: user.id }, { totpEnabled: false, totpSecret: null, totpRecoveryCodes: null });
        return {
            success: true,
            message: `2FA desactivado para ${user.email}.`,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                totpEnabled: false,
            },
        };
    }
    getJwtTokens(payload) {
        const accessMs = this.parseMs(this.configService.get('ACCESS_TOKEN_MAXAGE'), DEFAULT_ACCESS_MAX_AGE_MS);
        const refreshMs = this.parseMs(this.configService.get('REFRESH_TOKEN_MAXAGE'), DEFAULT_REFRESH_MAX_AGE_MS);
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: Math.max(60, Math.floor(accessMs / 1000)),
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: Math.max(60, Math.floor(refreshMs / 1000)),
        });
        return { accessToken, refreshToken };
    }
    parseMs(raw, fallback) {
        if (!raw)
            return fallback;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
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
        const emailToken = this.verificationTokenRepository.create({
            token,
            expiresAt,
            user,
            type,
        });
        await this.verificationTokenRepository.save(emailToken);
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
            message: 'Se ha enviado un nuevo código de verificación',
            email,
        };
    }
    async resendActivationLink(requestNewCodeDTO) {
        const { email } = requestNewCodeDTO;
        const user = await this.userRepository.findOne({
            where: { email },
            select: { id: true, email: true, isActive: true },
        });
        if (!user) {
            return {
                message: 'Si el correo está registrado y la cuenta no está activa, te enviaremos un nuevo enlace de activación',
            };
        }
        if (user.isActive) {
            return {
                message: 'Esta cuenta ya está activa',
            };
        }
        await this.verificationTokenRepository.update({ user: { id: user.id }, type: 'activation', isUsed: false }, { isUsed: true });
        const token = await this.generateAndStoreToken(user, 'activation');
        await this.mailService.sendActivateUser(user.email, user.id, token);
        return {
            message: 'Si el correo está registrado y la cuenta no está activa, te enviaremos un nuevo enlace de activación',
        };
    }
    async activateUser(validateTokenDTO) {
        const { idUser } = validateTokenDTO;
        await this.validateToken(validateTokenDTO);
        const user = await this.userRepository.findOneBy({ id: idUser });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        await this.userRepository.update({ id: idUser }, { isActive: true });
        return {
            message: 'Usuario activado correctamente'
        };
    }
    async validateToken(validateTokenDTO) {
        const { idUser, otp } = validateTokenDTO;
        const token = await this.verificationTokenRepository.findOne({
            where: { user: { id: idUser }, token: otp, type: 'activation', isUsed: false },
        });
        if (!token)
            throw new common_1.BadRequestException('Código inválido');
        if (token.expiresAt < new Date())
            throw new common_1.BadRequestException('Token expired');
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
        const user = await this.userRepository.findOne({
            where: { email },
        });
        if (!user) {
            return {
                message: 'Si el correo está registrado, te enviaremos un código de recuperación',
            };
        }
        await this.verificationTokenRepository.update({ user: { id: user.id }, type: 'password-reset', isUsed: false }, { isUsed: true });
        const token = await this.generateAndStoreToken(user, 'password-reset');
        await this.mailService.sendPasswordResetCode(email, token);
        return {
            message: 'Si el correo está registrado, te enviaremos un código de recuperación',
        };
    }
    async resetPassword(resetPasswordDTO) {
        const { email, code, newPassword } = resetPasswordDTO;
        const user = await this.userRepository.findOne({
            where: { email },
            select: { id: true, email: true, password: true },
        });
        if (!user) {
            throw new common_1.BadRequestException('Correo no encontrado');
        }
        const token = await this.verificationTokenRepository.findOne({
            where: {
                user: { id: user.id },
                token: code,
                type: 'password-reset',
                isUsed: false
            },
        });
        if (!token) {
            const tokenByCode = await this.verificationTokenRepository.findOne({
                where: { user: { id: user.id }, token: code, type: 'password-reset' },
            });
            if (tokenByCode) {
                if (tokenByCode.isUsed) {
                    throw new common_1.BadRequestException('Este código ya fue usado. Solicita un nuevo código.');
                }
                if (tokenByCode.expiresAt < new Date()) {
                    throw new common_1.BadRequestException('El código expiró. Solicita un nuevo código.');
                }
            }
            throw new common_1.BadRequestException('Código inválido');
        }
        if (token.expiresAt < new Date()) {
            throw new common_1.BadRequestException('El código expiró');
        }
        token.isUsed = true;
        await this.verificationTokenRepository.save(token);
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await this.userRepository.update({ id: user.id }, { password: hashedPassword });
        return {
            message: 'Contraseña actualizada correctamente',
        };
    }
    async createStaffUser(dto) {
        try {
            const existing = await this.userRepository.findOne({
                where: { email: dto.email.trim().toLowerCase() },
                select: ['id'],
            });
            if (existing) {
                throw new common_1.BadRequestException('Ya existe un usuario con ese correo');
            }
            const user = this.userRepository.create({
                email: dto.email.trim().toLowerCase(),
                fullName: dto.fullName.trim(),
                phone: dto.phone?.trim() || undefined,
                password: bcrypt.hashSync(dto.password, 10),
                isActive: true,
                provider: 'local',
                roles: [...new Set(dto.roles)],
            });
            await this.userRepository.save(user);
            return {
                success: true,
                message: 'Usuario de staff creado y activo',
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    phone: user.phone,
                    isActive: user.isActive,
                    roles: user.roles,
                    createdAt: user.createdAt,
                },
            };
        }
        catch (e) {
            if (e instanceof common_1.BadRequestException)
                throw e;
            this.handleDBErrors(e);
        }
    }
    async updateStaffUser(id, dto) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        if (!(0, staff_roles_util_1.userHasStaffRole)(user.roles)) {
            throw new common_1.BadRequestException('Este usuario no es de staff interno');
        }
        const patch = {};
        if (dto.fullName?.trim())
            patch.fullName = dto.fullName.trim();
        if (dto.email?.trim()) {
            const email = dto.email.trim().toLowerCase();
            if (email !== user.email) {
                const taken = await this.userRepository.findOne({
                    where: { email },
                    select: ['id'],
                });
                if (taken && taken.id !== id) {
                    throw new common_1.BadRequestException('Ya existe otro usuario con ese correo');
                }
                patch.email = email;
            }
        }
        if (dto.phone !== undefined)
            patch.phone = dto.phone.trim() || undefined;
        if (dto.roles?.length)
            patch.roles = [...new Set(dto.roles)];
        if (dto.isActive !== undefined)
            patch.isActive = dto.isActive;
        if (dto.password)
            patch.password = bcrypt.hashSync(dto.password, 10);
        await this.userRepository.update({ id }, patch);
        const updated = await this.userRepository.findOne({
            where: { id },
            select: [
                'id',
                'email',
                'fullName',
                'phone',
                'isActive',
                'roles',
                'createdAt',
                'provider',
                'totpEnabled',
            ],
        });
        return {
            success: true,
            message: 'Usuario de staff actualizado',
            user: updated,
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
        mail_service_1.MailService,
        totp_service_1.TotpService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map