"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SqlMigrationsRunner_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlMigrationsRunner = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const fs_1 = require("fs");
const path_1 = require("path");
const MIGRATIONS_TABLE = 'ppp_schema_migrations';
const IDEMPOTENT_ERR_CODES = new Set([
    'ER_DUP_FIELDNAME',
    'ER_TABLE_EXISTS_ERROR',
    'ER_DUP_KEYNAME',
    'ER_DUP_ENTRY',
]);
let SqlMigrationsRunner = SqlMigrationsRunner_1 = class SqlMigrationsRunner {
    config;
    dataSource;
    logger = new common_1.Logger(SqlMigrationsRunner_1.name);
    constructor(config, dataSource) {
        this.config = config;
        this.dataSource = dataSource;
    }
    async onApplicationBootstrap() {
        try {
            await this.runAll();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Migrations failed (API continues): ${message}`);
        }
    }
    async runAll() {
        await this.ensureClientRequestIdColumn();
        if (!this.isEnabled()) {
            this.logger.log('RUN_MIGRATIONS disabled — skipping folder SQL migrations');
            return;
        }
        const dir = this.resolveMigrationsDir();
        if (!dir) {
            this.logger.warn('RUN_MIGRATIONS=true but migrations/ folder not found');
            return;
        }
        this.logger.log(`Running SQL migrations from ${dir}`);
        await this.ensureMigrationsTable();
        const files = (0, fs_1.readdirSync)(dir)
            .filter((f) => f.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const applied = await this.getAppliedNames();
        let ran = 0;
        for (const file of files) {
            if (applied.has(file))
                continue;
            const fullPath = (0, path_1.join)(dir, file);
            const sql = (0, fs_1.readFileSync)(fullPath, 'utf8');
            if (/^\s*DELIMITER\b/im.test(sql)) {
                this.logger.warn(`⚠ ${file} usa DELIMITER — ejecutar manualmente; se omite`);
                continue;
            }
            const statements = this.splitStatements(sql);
            this.logger.log(`Applying ${file} (${statements.length} statement(s))…`);
            try {
                for (const stmt of statements) {
                    try {
                        await this.dataSource.query(stmt);
                    }
                    catch (stmtErr) {
                        if (this.isIdempotentError(stmtErr)) {
                            this.logger.warn(`  (skipped — already in DB)`);
                            continue;
                        }
                        throw stmtErr;
                    }
                }
                await this.markApplied(file);
                ran += 1;
                this.logger.log(`✓ ${file}`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`✗ ${file}: ${message}`);
                throw err;
            }
        }
        this.logger.log(ran === 0
            ? 'Migrations up to date'
            : `Applied ${ran} migration(s)`);
    }
    async ensureClientRequestIdColumn() {
        try {
            const rows = await this.dataSource.query(`SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_orders'
           AND COLUMN_NAME = 'client_request_id'`);
            if (Number(rows?.[0]?.c) > 0) {
                return;
            }
            this.logger.warn('Missing column ppp_orders.client_request_id — adding now');
            await this.dataSource.query(`
        ALTER TABLE ppp_orders
        ADD COLUMN client_request_id VARCHAR(64) NULL DEFAULT NULL
          COMMENT 'Clave de idempotencia del cliente (UUID o mp-pay-{id})'
      `);
            try {
                await this.dataSource.query(`
          CREATE UNIQUE INDEX uq_ppp_orders_client_request_id
            ON ppp_orders (client_request_id)
        `);
            }
            catch (idxErr) {
                if (!this.isIdempotentError(idxErr))
                    throw idxErr;
            }
            this.logger.log('✓ ppp_orders.client_request_id ready');
        }
        catch (err) {
            if (this.isIdempotentError(err))
                return;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to ensure client_request_id: ${message}`);
            throw err;
        }
    }
    isEnabled() {
        const raw = (this.config.get('RUN_MIGRATIONS') ?? '').trim().toLowerCase();
        return raw === 'true' || raw === '1' || raw === 'yes';
    }
    resolveMigrationsDir() {
        const candidates = [
            (0, path_1.join)(process.cwd(), 'migrations'),
            (0, path_1.join)(__dirname, '..', '..', '..', 'migrations'),
            (0, path_1.join)(__dirname, '..', '..', 'migrations'),
        ];
        for (const dir of candidates) {
            if ((0, fs_1.existsSync)(dir))
                return dir;
        }
        return null;
    }
    async ensureMigrationsTable() {
        await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ppp_schema_migrations_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    }
    async getAppliedNames() {
        const rows = await this.dataSource.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
        return new Set(rows.map((r) => r.name));
    }
    async markApplied(name) {
        await this.dataSource.query(`INSERT IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [name]);
    }
    splitStatements(sql) {
        const withoutComments = sql
            .split('\n')
            .map((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('--'))
                return '';
            return line.replace(/--.*$/, '');
        })
            .join('\n');
        return withoutComments
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }
    isIdempotentError(err) {
        const e = err;
        if (e?.code && IDEMPOTENT_ERR_CODES.has(e.code))
            return true;
        if (e?.errno === 1060 || e?.errno === 1050 || e?.errno === 1061)
            return true;
        const msg = String(e?.message ?? err).toLowerCase();
        return (msg.includes('duplicate column') ||
            msg.includes('already exists') ||
            msg.includes('duplicate key name'));
    }
};
exports.SqlMigrationsRunner = SqlMigrationsRunner;
exports.SqlMigrationsRunner = SqlMigrationsRunner = SqlMigrationsRunner_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_1.DataSource])
], SqlMigrationsRunner);
//# sourceMappingURL=sql-migrations.runner.js.map