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
            expiresIn: '2m',
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
            const tokens = this.getJwtTokens({ id: user.id });
            return {
                user,
                ...tokens
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
    async generateAndStoreToken(user) {
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        const expiresAtBogota = new Date(expiresAt.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        const emailToken = this.verificationTokenRepository.create({
            token,
            expiresAt: expiresAtBogota,
            user,
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
        await this.verificationTokenRepository.update({ user: { id: user.id }, isUsed: false }, { isUsed: true });
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        const newToken = this.verificationTokenRepository.create({
            token,
            expiresAt,
            user,
        });
        await this.verificationTokenRepository.save(newToken);
        await this.mailService.sendVerificationCode(email, token);
        return {
            message: 'A new verification code has been sent',
            email,
        };
    }
    async activateUser(validateTokenDTO) {
        const { userId } = validateTokenDTO;
        await this.validateToken(validateTokenDTO);
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user)
            throw new common_1.BadRequestException('Usuario no encontrado');
        user.isActive = true;
        await this.userRepository.save(user);
        return {
            message: 'Usuario activado correctamente'
        };
    }
    async validateToken(validateTokenDTO) {
        const { userId, code } = validateTokenDTO;
        const token = await this.verificationTokenRepository.findOne({
            where: { user: { id: userId }, token: code, isUsed: false },
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