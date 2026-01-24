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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),


    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Log pool configuration
        process.stdout.write('\n🔧 [DB Pool Config]\n');
        process.stdout.write('  Pool Size: 100 (maxed for unlimited database)\n');
        process.stdout.write('  Connection Limit: 100\n');
        process.stdout.write('  Queue Limit: 0 (unlimited - no "Queue limit reached")\n');
        process.stdout.write('  Retry Attempts: 5 | Keep Connection Alive: true\n\n');
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
          // Maxed pool for unlimited database - avoid "Queue limit reached"
          poolSize: 100, // Max connections in TypeORM pool
          keepConnectionAlive: true,
          connectTimeout: 15000, // 15s for initial connection
          retryAttempts: 5,
          retryDelay: 3000,
          extra: {
            connectionLimit: 100, // Match poolSize - max connections in mysql2 pool
            waitForConnections: true, // Requests wait for a free connection
            queueLimit: 0, // Unlimited queue - never "Queue limit reached"; requests wait
            maxIdle: 50, // Keep many idle connections ready
            idleTimeout: 600000, // 10 minutes
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }