import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';


async function bootstrap() {
  
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api')
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
/*
   app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
    forbidNonWhitelisted: true
  }))
*/
   app.use(cookieParser());



const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

const bindHost = process.env.BIND_HOST === "true";

if (bindHost) {
  await app.listen(port, host);
} else {
  await app.listen(port);
}

}
bootstrap();
