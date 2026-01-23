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
        process.stdout.write('  Pool Size: 20 (optimized for unlimited database)\n');
        process.stdout.write('  Connection Limit: 30\n');
        process.stdout.write('  Retry Attempts: 5\n');
        process.stdout.write('  Keep Connection Alive: true\n\n');
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
          // Optimized pool configuration for unlimited database
          poolSize: 20, // Increased pool size for better performance
          keepConnectionAlive: true, // Reuse connections
          connectTimeout: 10000, // 10 seconds for initial connection
          // Enable retries with reasonable limits
          retryAttempts: 5, // Retry up to 5 times on connection failure
          retryDelay: 3000, // Wait 3 seconds between retries
          extra: {
            // Optimized pool configuration for unlimited database
            connectionLimit: 30, // Increased connection limit
            waitForConnections: true, // Wait instead of failing immediately
            queueLimit: 50, // Increased queue limit
            maxIdle: 10, // Allow more idle connections
            idleTimeout: 600000, // Close idle connections after 10 minutes (600000ms)
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