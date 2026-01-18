"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const common_module_1 = require("../common/common.module");
const cookie_service_1 = require("./cookie.service");
const user_entity_1 = require("./entities/user.entity");
const verification_token_entity_1 = require("./entities/verification-token.entity");
const address_entity_1 = require("./entities/address.entity");
const phone_entity_1 = require("./entities/phone.entity");
const jwt_strategy_1 = require("./stretegies/jwt.strategy");
const refresh_token_strategy_1 = require("./stretegies/refresh-token.strategy");
const google_strategy_1 = require("./stretegies/google.strategy");
const user_addresses_controller_1 = require("./user-addresses.controller");
const user_addresses_service_1 = require("./user-addresses.service");
const user_phones_controller_1 = require("./user-phones.controller");
const user_phones_service_1 = require("./user-phones.service");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        controllers: [auth_controller_1.AuthController, user_addresses_controller_1.UserAddressesController, user_phones_controller_1.UserPhonesController],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            refresh_token_strategy_1.RefreshTokenStrategy,
            google_strategy_1.GoogleStrategy,
            cookie_service_1.CookieService,
            user_addresses_service_1.UserAddressesService,
            user_phones_service_1.UserPhonesService,
        ],
        imports: [
            common_module_1.CommonModule,
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, verification_token_entity_1.VerificationToken, address_entity_1.Address, phone_entity_1.Phone]),
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    return {
                        secret: configService.get("JWT_SECRET"),
                        signOptions: {
                            expiresIn: '2m'
                        }
                    };
                }
            })
        ],
        exports: [typeorm_1.TypeOrmModule, jwt_strategy_1.JwtStrategy, passport_1.PassportModule, jwt_1.JwtModule]
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map