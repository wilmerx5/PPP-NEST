"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const orders_module_1 = require("./orders/orders.module");
const products_module_1 = require("./products/products.module");
const common_module_1 = require("./common/common.module");
const payments_module_1 = require("./payments/payments.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => {
                    process.stdout.write('\n🔧 [DB Pool Config]\n');
                    process.stdout.write('  Pool Size: 100 | Connection Limit: 100 | Queue Limit: 0\n');
                    process.stdout.write('  Idle Timeout: 60s | Max Idle: 10 (evitar ECONNRESET por conexiones muertas)\n');
                    process.stdout.write('  Keep-Alive: true | Retry: 5\n\n');
                    const dbConfig = {
                        type: 'mariadb',
                        host: configService.get('DB_HOST'),
                        port: configService.get('DB_PORT'),
                        username: configService.get('DB_USERNAME'),
                        password: configService.get('DB_PASSWORD'),
                        database: configService.get('DB_DATABASE'),
                        entities: [__dirname + '/**/*.entity{.ts,.js}'],
                        synchronize: false,
                        timezone: 'Z',
                        poolSize: 100,
                        keepConnectionAlive: true,
                        connectTimeout: 15000,
                        retryAttempts: 5,
                        retryDelay: 3000,
                        extra: {
                            connectionLimit: 100,
                            waitForConnections: true,
                            queueLimit: 0,
                            maxIdle: 10,
                            idleTimeout: 60000,
                            enableKeepAlive: true,
                            keepAliveInitialDelay: 0,
                        },
                    };
                    process.stdout.write('\n🔍 [DB Connection Config]\n');
                    process.stdout.write(`  Host: ${dbConfig.host || 'NOT SET'}\n`);
                    process.stdout.write(`  Port: ${dbConfig.port || 'NOT SET'}\n`);
                    process.stdout.write(`  Username: ${dbConfig.username || 'NOT SET'}\n`);
                    process.stdout.write(`  Database: ${dbConfig.database || 'NOT SET'}\n`);
                    process.stdout.write(`  Password: ${dbConfig.password ? dbConfig.password.substring(0, 3) + '***' : 'NOT SET'}\n`);
                    process.stdout.write(`  Entities path: ${Array.isArray(dbConfig.entities) ? dbConfig.entities[0] : dbConfig.entities}\n`);
                    process.stdout.write(`  Synchronize: ${dbConfig.synchronize}\n`);
                    const missingVars = [];
                    if (!dbConfig.host)
                        missingVars.push('DB_HOST');
                    if (!dbConfig.port)
                        missingVars.push('DB_PORT');
                    if (!dbConfig.username)
                        missingVars.push('DB_USERNAME');
                    if (!dbConfig.password)
                        missingVars.push('DB_PASSWORD');
                    if (!dbConfig.database)
                        missingVars.push('DB_DATABASE');
                    if (missingVars.length > 0) {
                        process.stderr.write(`❌ [DB Config Error] Missing environment variables: ${missingVars.join(', ')}\n`);
                    }
                    else {
                        process.stdout.write('✅ [DB Config] All required variables are set\n\n');
                    }
                    return dbConfig;
                },
                inject: [config_1.ConfigService],
            }),
            orders_module_1.OrdersModule,
            products_module_1.ProductsModule,
            auth_module_1.AuthModule,
            common_module_1.CommonModule,
            payments_module_1.PaymentsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map