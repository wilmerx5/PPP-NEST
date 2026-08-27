import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { CommonModule } from './common/common.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BusinessModule } from './business/business.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FactusModule } from './factus/factus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),


    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = {
          type: 'mariadb' as const,
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          timezone: 'Z', // UTC timezone
          poolSize: 100,
          keepConnectionAlive: true,
          connectTimeout: 15000,
          retryAttempts: 5,
          retryDelay: 3000,
          extra: {
            connectionLimit: 100,
            waitForConnections: true,
            queueLimit: 0,
            maxIdle: 10,
            idleTimeout: 60000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            // Query timeout: matar queries que tardan > 5s para evitar bloqueos
            queryTimeout: 5000,
            // Reconnect: reconectar automáticamente si se pierde la conexión
            reconnect: true,
          },
        };

        const missingVars = [] as string[];
        if (!dbConfig.host) missingVars.push('DB_HOST');
        if (!dbConfig.port) missingVars.push('DB_PORT');
        if (!dbConfig.username) missingVars.push('DB_USERNAME');
        if (!dbConfig.password) missingVars.push('DB_PASSWORD');
        if (!dbConfig.database) missingVars.push('DB_DATABASE');
        if (missingVars.length > 0) {
          process.stderr.write(`❌ [DB Config] Missing: ${missingVars.join(', ')}\n`);
        }

        return dbConfig;
      },
      inject: [ConfigService],
    }),

    OrdersModule,

    ProductsModule,

    AuthModule,

    CommonModule,

    PaymentsModule,
    ExpensesModule,
    BusinessModule,
    WhatsappModule,
    FactusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
