import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import { DbExceptionFilter } from './common/filters/db-exception.filter';
import { DbRetryInterceptor } from './common/interceptors/db-retry.interceptor';
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor';

// Errores no capturados: log + exit para que Render reinicie
function setupProcessHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    process.stderr.write(`\n❌ [unhandledRejection] ${String(reason)}\n`);
    const err = reason instanceof Error ? reason : new Error(String(reason));
    if (err.stack) process.stderr.write(err.stack + '\n');
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

  // Logs directos a stdout para evitar intercepción de loggers
  process.stdout.write('\n🚀 [Bootstrap] Starting NestJS application...\n');
  process.stdout.write('📋 [Environment] Checking .env variables...\n');
  process.stdout.write(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}\n`);
  process.stdout.write(`  DB_PORT: ${process.env.DB_PORT || 'NOT SET'}\n`);
  process.stdout.write(`  DB_USERNAME: ${process.env.DB_USERNAME || 'NOT SET'}\n`);
  process.stdout.write(`  DB_DATABASE: ${process.env.DB_DATABASE || 'NOT SET'}\n`);
  process.stdout.write(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.substring(0, 3) + '***' : 'NOT SET'}\n\n`);
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalFilters(new DbExceptionFilter());
  app.useGlobalInterceptors(new DbRetryInterceptor(), new RequestTimeoutInterceptor(30000));

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setGlobalPrefix('api');
app.enableCors({
  origin: (origin, callback) => {

    if (!origin) return callback(null, true);

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
    const isNgrok = /\.ngrok-free\.app$/.test(hostname) || /\.ngrok\.io$/.test(hostname) || /\.ngrok\.app$/.test(hostname); // ← Permite ngrok

    if (
      allowedOrigins.includes(origin) ||
      isProdSubdomain ||
      isLocalhostSubdomain ||
      isPppLocalSubdomain ||
      isNgrok
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"), false);
  },

  credentials: true,
});

  const config = new DocumentBuilder()
  .setTitle("ppp")
  .setDescription("PPP api")
  .setVersion("1.0")
  .addTag("ordenes")
  .build()
  

  const document= SwaggerModule.createDocument(app,config)
  SwaggerModule.setup("api",app,document)
/*
   app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
    forbidNonWhitelisted: true
  }))
*/
   app.use(cookieParser());



  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';
  const bindHost = process.env.BIND_HOST === 'true';

  if (bindHost) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }

  process.stdout.write(`\n✅ [Bootstrap] Listening on port ${port}\n`);

  const shutdown = async (signal: string) => {
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
  if (err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
});
