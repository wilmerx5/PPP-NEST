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
    const allowedOrigins = [
      "http://localhost:5173",
      /\.prontopolloportal\.com$/,       // todos los subdominios
      "https://prontopolloportal.com",   // dominio raíz
    ];

    if (!origin) return callback(null, true); // permitir Postman / servidor interno

    const isAllowed = allowedOrigins.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed by CORS"), false);
    }
  },

  credentials: true, // ⬅ necesario para cookies
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
  await app.listen(process.env.PORT ?? 4000);

}
bootstrap();
