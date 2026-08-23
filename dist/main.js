"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
try {
    const g = global;
    if (typeof g.crypto?.randomBytes !== 'function') {
        g.crypto = crypto;
    }
}
catch {
}
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const db_exception_filter_1 = require("./common/filters/db-exception.filter");
const db_retry_interceptor_1 = require("./common/interceptors/db-retry.interceptor");
const request_timeout_interceptor_1 = require("./common/interceptors/request-timeout.interceptor");
const cors_allowed_1 = require("./common/cors-allowed");
function setupProcessHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
        process.stderr.write(`\n❌ [unhandledRejection] ${String(reason)}\n`);
        const err = reason instanceof Error ? reason : new Error(String(reason));
        if (err.stack)
            process.stderr.write(err.stack + '\n');
        process.exit(1);
    });
    process.on('uncaughtException', (err) => {
        process.stderr.write(`\n❌ [uncaughtException] ${err.message}\n`);
        process.stderr.write((err.stack || '') + '\n');
        process.exit(1);
    });
}
async function bootstrap() {
    setupProcessHandlers();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use(cookieParser());
    app.useGlobalFilters(new db_exception_filter_1.DbExceptionFilter());
    app.useGlobalInterceptors(new db_retry_interceptor_1.DbRetryInterceptor(), new request_timeout_interceptor_1.RequestTimeoutInterceptor(30000));
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'public'));
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: (origin, callback) => {
            if ((0, cors_allowed_1.isAllowedCorsOrigin)(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Origin not allowed by CORS'), false);
        },
        credentials: true,
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle("ppp")
        .setDescription("PPP api")
        .setVersion("1.0")
        .addTag("ordenes")
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup("api", app, document);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    const bindHost = process.env.BIND_HOST === 'true';
    if (bindHost) {
        await app.listen(port, host);
    }
    else {
        await app.listen(port);
    }
    process.stdout.write(`\n✅ [Bootstrap] Listening on port ${port}\n`);
    const shutdown = async (signal) => {
        process.stdout.write(`\n🛑 [${signal}] Graceful shutdown...\n`);
        await app.close();
        process.stdout.write('👋 [Shutdown] Closed.\n');
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM').catch(() => process.exit(1)));
    process.on('SIGINT', () => shutdown('SIGINT').catch(() => process.exit(1)));
}
bootstrap().catch((err) => {
    process.stderr.write(`\n❌ [Bootstrap] ${err.message}\n`);
    if (err.stack)
        process.stderr.write(err.stack + '\n');
    process.exit(1);
});
//# sourceMappingURL=main.js.map