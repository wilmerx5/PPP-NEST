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
        await this.ensureProductScheduleSchema();
        await this.ensureWhatsappSchema();
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
    async ensureProductScheduleSchema() {
        try {
            const col = await this.dataSource.query(`SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_products'
           AND COLUMN_NAME = 'has_schedule'`);
            if (Number(col?.[0]?.c) === 0) {
                this.logger.warn('Missing column ppp_products.has_schedule — adding now');
                await this.dataSource.query(`
          ALTER TABLE ppp_products
          ADD COLUMN has_schedule TINYINT(1) NOT NULL DEFAULT 0
        `);
                this.logger.log('✓ ppp_products.has_schedule ready');
            }
            const table = await this.dataSource.query(`SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_product_schedules'`);
            if (Number(table?.[0]?.c) === 0) {
                this.logger.warn('Missing table ppp_product_schedules — creating now');
                await this.dataSource.query(`
          CREATE TABLE ppp_product_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            day_of_week TINYINT NOT NULL,
            start_time VARCHAR(5) NULL,
            end_time VARCHAR(5) NULL,
            INDEX idx_product_schedules_product (product_id),
            CONSTRAINT fk_product_schedules_product
              FOREIGN KEY (product_id) REFERENCES ppp_products(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
                this.logger.log('✓ ppp_product_schedules ready');
            }
        }
        catch (err) {
            if (this.isIdempotentError(err))
                return;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to ensure product schedule schema: ${message}`);
            throw err;
        }
    }
    async ensureWhatsappSchema() {
        try {
            const table = await this.dataSource.query(`SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_settings'`);
            if (Number(table?.[0]?.c) > 0) {
                await this.dataSource.query(`UPDATE ppp_whatsapp_settings
           SET default_delivery_fee = 2000
           WHERE id = 1 AND (default_delivery_fee IS NULL OR default_delivery_fee = 0)`);
                await this.ensureWhatsappSettingsColumns();
                return;
            }
            this.logger.warn('Missing WhatsApp tables — creating now (022_whatsapp_module)');
            await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ppp_whatsapp_settings (
          id INT NOT NULL PRIMARY KEY DEFAULT 1,
          enabled TINYINT(1) NOT NULL DEFAULT 0,
          display_phone VARCHAR(32) NULL,
          phone_number_id VARCHAR(64) NULL,
          waba_id VARCHAR(64) NULL,
          access_token TEXT NULL,
          verify_token VARCHAR(128) NULL,
          openai_api_key TEXT NULL,
          openai_model VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini',
          system_prompt TEXT NULL,
          default_delivery_fee INT NOT NULL DEFAULT 2000,
          allow_mercado_pago TINYINT(1) NOT NULL DEFAULT 1,
          welcome_message TEXT NULL,
          restaurant_name VARCHAR(120) NULL,
          restaurant_address VARCHAR(500) NULL,
          restaurant_city VARCHAR(120) NULL,
          restaurant_neighborhood VARCHAR(120) NULL,
          maps_url VARCHAR(500) NULL,
          public_phone VARCHAR(40) NULL,
          landmarks TEXT NULL,
          pickup_notes TEXT NULL,
          delivery_notes TEXT NULL,
          ai_extra_context TEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            await this.dataSource.query(`INSERT IGNORE INTO ppp_whatsapp_settings (id) VALUES (1)`);
            await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ppp_whatsapp_conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          wa_id VARCHAR(32) NOT NULL,
          phone_e164 VARCHAR(32) NOT NULL,
          customer_name VARCHAR(120) NULL,
          state VARCHAR(40) NOT NULL DEFAULT 'building_cart',
          session_data JSON NULL,
          human_takeover TINYINT(1) NOT NULL DEFAULT 0,
          human_agent_id VARCHAR(36) NULL,
          human_agent_name VARCHAR(120) NULL,
          last_message_at TIMESTAMP NULL,
          last_inbound_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_whatsapp_wa_id (wa_id),
          INDEX idx_whatsapp_conv_phone (phone_e164),
          INDEX idx_whatsapp_conv_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ppp_whatsapp_messages (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          direction ENUM('in', 'out') NOT NULL,
          message_type VARCHAR(20) NOT NULL DEFAULT 'text',
          body TEXT NULL,
          wa_message_id VARCHAR(128) NULL,
          sent_by VARCHAR(20) NOT NULL DEFAULT 'bot',
          raw_payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_whatsapp_msg_conv (conversation_id),
          CONSTRAINT fk_whatsapp_msg_conv
            FOREIGN KEY (conversation_id) REFERENCES ppp_whatsapp_conversations (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            await this.ensureWhatsappSettingsColumns();
            this.logger.log('✓ WhatsApp schema ready');
        }
        catch (err) {
            if (this.isIdempotentError(err))
                return;
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to ensure WhatsApp schema: ${message}`);
            throw err;
        }
    }
    async ensureWhatsappSettingsColumns() {
        const cols = [
            { name: 'restaurant_name', ddl: 'VARCHAR(120) NULL' },
            { name: 'restaurant_address', ddl: 'VARCHAR(500) NULL' },
            { name: 'restaurant_city', ddl: 'VARCHAR(120) NULL' },
            { name: 'restaurant_neighborhood', ddl: 'VARCHAR(120) NULL' },
            { name: 'maps_url', ddl: 'VARCHAR(500) NULL' },
            { name: 'public_phone', ddl: 'VARCHAR(40) NULL' },
            { name: 'landmarks', ddl: 'TEXT NULL' },
            { name: 'pickup_notes', ddl: 'TEXT NULL' },
            { name: 'delivery_notes', ddl: 'TEXT NULL' },
            { name: 'ai_extra_context', ddl: 'TEXT NULL' },
            { name: 'menu_url', ddl: 'VARCHAR(500) NULL' },
            { name: 'website_url', ddl: 'VARCHAR(500) NULL' },
            { name: 'instagram_url', ddl: 'VARCHAR(500) NULL' },
            { name: 'ignore_business_hours', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'prep_time_note', ddl: 'VARCHAR(255) NULL' },
            { name: 'delivery_time_note', ddl: 'VARCHAR(255) NULL' },
            { name: 'min_order_amount', ddl: 'INT NOT NULL DEFAULT 0' },
            { name: 'payment_instructions', ddl: 'TEXT NULL' },
            { name: 'hours_note', ddl: 'TEXT NULL' },
            { name: 'cancel_policy_note', ddl: 'TEXT NULL' },
            { name: 'human_handoff_message', ddl: 'TEXT NULL' },
            { name: 'closed_message', ddl: 'TEXT NULL' },
            { name: 'menu_link_message', ddl: 'TEXT NULL' },
            { name: 'order_success_message', ddl: 'TEXT NULL' },
            { name: 'ai_temperature', ddl: 'DECIMAL(3,2) NULL DEFAULT 0.20' },
        ];
        for (const col of cols) {
            const exists = await this.dataSource.query(`SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_settings'
           AND COLUMN_NAME = ?`, [col.name]);
            if (Number(exists?.[0]?.c) > 0)
                continue;
            await this.dataSource.query(`ALTER TABLE ppp_whatsapp_settings ADD COLUMN ${col.name} ${col.ddl}`);
            this.logger.log(`✓ WhatsApp settings column added: ${col.name}`);
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