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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),


    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Log pool configuration
        process.stdout.write('\n🔧 [DB Pool Config - Anti-bloqueo]\n');
        process.stdout.write('  Pool: 100 | Idle: 10 (60s timeout) | Queue: ilimitada\n');
        process.stdout.write('  Query Timeout: 5s | Keep-Alive: true | Retry: 5\n');
        process.stdout.write('  Cache: 45s TTL | Circuit Breaker: 5 fallos → OPEN\n\n');
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

        // Logs detallados de conexión (sin mostrar password completo)
        process.stdout.write('\n🔍 [DB Connection Config]\n');
        process.stdout.write(`  Host: ${dbConfig.host || 'NOT SET'}\n`);
        process.stdout.write(`  Port: ${dbConfig.port || 'NOT SET'}\n`);
        process.stdout.write(`  Username: ${dbConfig.username || 'NOT SET'}\n`);
        process.stdout.write(`  Database: ${dbConfig.database || 'NOT SET'}\n`);
        process.stdout.write(`  Password: ${dbConfig.password ? dbConfig.password.substring(0, 3) + '***' : 'NOT SET'}\n`);
        process.stdout.write(`  Entities path: ${Array.isArray(dbConfig.entities) ? dbConfig.entities[0] : dbConfig.entities}\n`);
        process.stdout.write(`  Synchronize: ${dbConfig.synchronize}\n`);

        // Validar que todas las variables estén presentes
        const missingVars = [] as string[];
        if (!dbConfig.host) missingVars.push('DB_HOST');
        if (!dbConfig.port) missingVars.push('DB_PORT');
        if (!dbConfig.username) missingVars.push('DB_USERNAME');
        if (!dbConfig.password) missingVars.push('DB_PASSWORD');
        if (!dbConfig.database) missingVars.push('DB_DATABASE');

        if (missingVars.length > 0) {
          process.stderr.write(`❌ [DB Config Error] Missing environment variables: ${missingVars.join(', ')}\n`);
        } else {
          process.stdout.write('✅ [DB Config] All required variables are set\n\n');
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }