import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';


async function bootstrap() {
  console.log(process.env.DB_HOST)
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api')
app.enableCors({
  origin: (origin, callback) => {

    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost",
      "https://prontopolloportal.com",
    ];

    const hostname = origin.replace(/^https?:\/\//, "");

    const isProdSubdomain = /\.prontopolloportal\.com(:\d+)?$/.test(hostname);
    const isLocalhostSubdomain = /\.localhost(:\d+)?$/.test(hostname);
    const isPppLocalSubdomain = /\.ppp\.local(:\d+)?$/.test(hostname); // ← AÑADIDO

    if (
      allowedOrigins.includes(origin) ||
      isProdSubdomain ||
      isLocalhostSubdomain ||
      isPppLocalSubdomain
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

   app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true
  }))

   app.use(cookieParser());
  await app.listen(process.env.PORT ?? 4000, "api.ppp.local");

}
bootstrap();
