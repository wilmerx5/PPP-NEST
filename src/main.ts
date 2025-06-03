import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';


async function bootstrap() {
  console.log(process.env.DB_HOST)
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: '*', // 🟢 Tu frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 4000);

}
bootstrap();
