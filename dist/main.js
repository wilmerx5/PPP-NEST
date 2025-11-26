"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            const allowedOrigins = [
                "http://localhost:5173",
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
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
    }));
    app.use(cookieParser());
    const port = Number(process.env.PORT) || 4000;
    const host = process.env.HOST || "0.0.0.0";
    console.log(port, host);
    await app.listen(port, host);
}
bootstrap();
//# sourceMappingURL=main.js.map