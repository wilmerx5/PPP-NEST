"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
async function bootstrap() {
    process.stdout.write('\n🚀 [Bootstrap] Starting NestJS application...\n');
    process.stdout.write('📋 [Environment] Checking .env variables...\n');
    process.stdout.write(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}\n`);
    process.stdout.write(`  DB_PORT: ${process.env.DB_PORT || 'NOT SET'}\n`);
    process.stdout.write(`  DB_USERNAME: ${process.env.DB_USERNAME || 'NOT SET'}\n`);
    process.stdout.write(`  DB_DATABASE: ${process.env.DB_DATABASE || 'NOT SET'}\n`);
    process.stdout.write(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + '***' : 'NOT SET'}\n\n`);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
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
                "http://localhost",
                "https://prontopolloportal.com",
            ];
            const hostname = origin.replace(/^https?:\/\//, "");
            const isProdSubdomain = /\.prontopolloportal\.com(:\d+)?$/.test(hostname);
            const isLocalhostSubdomain = /\.localhost(:\d+)?$/.test(hostname);
            const isPppLocalSubdomain = /\.ppp\.local(:\d+)?$/.test(hostname);
            if (allowedOrigins.includes(origin) ||
                isProdSubdomain ||
                isLocalhostSubdomain ||
                isPppLocalSubdomain) {
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
    const host = process.env.HOST || "0.0.0.0";
    const bindHost = process.env.BIND_HOST === "true";
    if (bindHost) {
        await app.listen(port, host);
    }
    else {
        await app.listen(port);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map