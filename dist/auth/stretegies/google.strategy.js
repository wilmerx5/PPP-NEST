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
exports.GoogleStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
let GoogleStrategy = class GoogleStrategy extends (0, passport_1.PassportStrategy)(passport_google_oauth20_1.Strategy, 'google') {
    userRepository;
    configService;
    constructor(userRepository, configService) {
        const clientID = configService.get('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get('GOOGLE_CLIENT_SECRET');
        const explicitCallbackURL = configService.get('GOOGLE_CALLBACK_URL');
        const backendUrlNgrok = configService.get('BACKEND_URL_NGROK');
        const backendUrl = configService.get('BACKEND_URL');
        const callbackURL = explicitCallbackURL ||
            (backendUrlNgrok ? `${backendUrlNgrok}/api/auth/google/callback` : null) ||
            (backendUrl ? `${backendUrl}/api/auth/google/callback` : null) ||
            'http://localhost:4000/api/auth/google/callback';
        console.log('[GoogleStrategy] Configuración OAuth:');
        console.log('  - GOOGLE_CALLBACK_URL:', explicitCallbackURL || 'no configurado');
        console.log('  - BACKEND_URL_NGROK:', backendUrlNgrok || 'no configurado');
        console.log('  - BACKEND_URL:', backendUrl || 'no configurado');
        console.log('  - Callback URL final:', callbackURL);
        console.log('  - Client ID:', clientID ? `${clientID.substring(0, 20)}...` : 'no configurado');
        if (!clientID || !clientSecret) {
            throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
        }
        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email', 'profile'],
        });
        this.userRepository = userRepository;
        this.configService = configService;
    }
    async validate(accessToken, refreshToken, profile) {
        const { id, name, emails } = profile;
        const email = emails?.[0]?.value;
        console.log('[GoogleStrategy.validate] Iniciando validación');
        console.log('[GoogleStrategy.validate] Email:', email);
        console.log('[GoogleStrategy.validate] Google ID:', id);
        console.log('[GoogleStrategy.validate] Full Name:', name?.displayName);
        if (!email) {
            console.error('[GoogleStrategy.validate] ERROR: Email no disponible');
            throw new Error('Email no disponible en el perfil de Google');
        }
        const fullName = name?.givenName && name?.familyName
            ? `${name.givenName} ${name.familyName}`
            : name?.displayName || email.split('@')[0] || 'Usuario';
        console.log('[GoogleStrategy.validate] Buscando usuario en DB...');
        let user = await this.userRepository.findOne({
            where: [{ googleId: id }, { email }],
        });
        if (!user) {
            console.log('[GoogleStrategy.validate] Usuario NO encontrado, creando nuevo...');
            try {
                user = this.userRepository.create({
                    email,
                    fullName,
                    googleId: id,
                    provider: 'google',
                    isActive: true,
                    phone: undefined,
                    password: undefined,
                    roles: ['user'],
                });
                console.log('[GoogleStrategy.validate] Usuario creado en memoria:', {
                    email: user.email,
                    fullName: user.fullName,
                    googleId: user.googleId,
                    provider: user.provider,
                });
                await this.userRepository.save(user);
                console.log('[GoogleStrategy.validate] ✅ Usuario guardado exitosamente en DB. ID:', user.id);
            }
            catch (error) {
                console.error('[GoogleStrategy.validate] ❌ ERROR al guardar usuario:', error);
                throw error;
            }
        }
        else if (!user.googleId) {
            console.log('[GoogleStrategy.validate] Usuario encontrado SIN googleId, vinculando cuenta...');
            user.googleId = id;
            user.provider = 'google';
            if (!user.isActive) {
                user.isActive = true;
            }
            await this.userRepository.save(user);
            console.log('[GoogleStrategy.validate] ✅ Cuenta vinculada exitosamente');
        }
        else {
            console.log('[GoogleStrategy.validate] Usuario existente encontrado. ID:', user.id);
        }
        return user;
    }
};
exports.GoogleStrategy = GoogleStrategy;
exports.GoogleStrategy = GoogleStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], GoogleStrategy);
//# sourceMappingURL=google.strategy.js.map