"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const db_exception_filter_1 = require("./common/filters/db-exception.filter");
const db_retry_interceptor_1 = require("./common/interceptors/db-retry.interceptor");
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
    process.stdout.write('\n🚀 [Bootstrap] Starting NestJS application...\n');
    process.stdout.write('📋 [Environment] Checking .env variables...\n');
    process.stdout.write(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}\n`);
    process.stdout.write(`  DB_PORT: ${process.env.DB_PORT || 'NOT SET'}\n`);
    process.stdout.write(`  DB_USERNAME: ${process.env.DB_USERNAME || 'NOT SET'}\n`);
    process.stdout.write(`  DB_DATABASE: ${process.env.DB_DATABASE || 'NOT SET'}\n`);
    process.stdout.write(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + '***' : 'NOT SET'}\n\n`);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new db_exception_filter_1.DbExceptionFilter());
    app.useGlobalInterceptors(new db_retry_interceptor_1.DbRetryInterceptor());
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'public'));
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            const allowedOrigins = [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "http://localhost:5176",
                "http://localhost:3001",
                "http://localhost:3000",
                "https://unperemptory-premorally-january.ngrok-free.dev",
                "https://prontopolloportal.com",
            ];
            const hostname = origin.replace(/^https?:\/\//, "");
            const isProdSubdomain = /\.prontopolloportal\.com(:\d+)?$/.test(hostname);
            const isLocalhostSubdomain = /\.localhost(:\d+)?$/.test(hostname);
            const isPppLocalSubdomain = /\.ppp\.local(:\d+)?$/.test(hostname);
            const isNgrok = /\.ngrok-free\.app$/.test(hostname) || /\.ngrok\.io$/.test(hostname) || /\.ngrok\.app$/.test(hostname);
            if (allowedOrigins.includes(origin) ||
                isProdSubdomain ||
                isLocalhostSubdomain ||
                isPppLocalSubdomain ||
                isNgrok) {
                return callback(null, true);
            }
            return callback(new Error("Origin not allowed by CORS"), false);
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
    app.use(cookieParser());
    const port = Number(process.env.PORT) || 4000;
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