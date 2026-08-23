import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
export declare class SqlMigrationsRunner implements OnApplicationBootstrap {
    private readonly config;
    private readonly dataSource;
    private readonly logger;
    constructor(config: ConfigService, dataSource: DataSource);
    onApplicationBootstrap(): Promise<void>;
    private runAll;
    private ensureClientRequestIdColumn;
    private ensureProductScheduleSchema;
    private ensureWhatsappSchema;
    private ensureWhatsappSettingsColumns;
    private isEnabled;
    private resolveMigrationsDir;
    private ensureMigrationsTable;
    private getAppliedNames;
    private markApplied;
    private splitStatements;
    private isIdempotentError;
}
