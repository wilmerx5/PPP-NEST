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
        const user = await this.userRepository.findOne({
            where: { email },
            select: { email: true, password: true, id: true, isActive: true, provider: true },
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