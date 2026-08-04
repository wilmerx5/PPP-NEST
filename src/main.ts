import * as crypto from 'crypto';
// Parche para librerías que esperan global.crypto (Node crypto).
// En Node 19+ global.crypto es de solo lectura (Web Crypto API), no podemos sobrescribir.
try {
  const g = global as any;
  if (typeof g.crypto?.randomBytes !== 'function') {
    g.crypto = crypto;
  }
} catch {
  // Node 24+: global.crypto es read-only, omitir parche
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import { DbExceptionFilter } from './common/filters/db-exception.filter';
import { DbRetryInterceptor } from './common/interceptors/db-retry.interceptor';
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor';
import { isAllowedCorsOrigin } from './common/cors-allowed';

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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalFilters(new DbExceptionFilter());
  app.useGlobalInterceptors(new DbRetryInterceptor(), new RequestTimeoutInterceptor(30000));

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setGlobalPrefix('api');
app.enableCors({
  origin: (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'), false);
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // false: no romper clientes que manden campos extra; sí se strippean
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

   app.use(cookieParser());



  const port = Number(process.env.PORT) || 3000;
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
