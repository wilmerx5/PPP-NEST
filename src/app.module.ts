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
        const dbConfig = {
          type: 'mariadb' as const,
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false, // Keep true to sync schema with dev - will disable later and use migrations
          // Store all es in UTC - conversion to Bogotá timezone happens in application layer
          timezone: 'Z', // UTC timezone
          // Pool configuration to prevent exceeding connection limits
          // Reduce pool size to avoid hitting 500 connections/hour limit
          poolSize: 5, // Maximum pool size (reduced to prevent exceeding limits)
          keepConnectionAlive: true, // Keep connections alive between requests
          connectTimeout: 30000, // 30 seconds for initial connection
          extra: {
            // Valid mysql2 pool options
            connectionLimit: 5, // Maximum number of connections in the pool (reduced)
            waitForConnections: true, // Wait for available connection instead of erroring
            queueLimit: 0, // Unlimited queue (0 = unlimited)
            maxIdle: 3, // Maximum idle connections (reduced)
            idleTimeout: 300000, // Close idle connections after 5 minutes (300000ms)
            enableKeepAlive: true, // Enable TCP keep-alive
            keepAliveInitialDelay: 0, // Start keep-alive immediately
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