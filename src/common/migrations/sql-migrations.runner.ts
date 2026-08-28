import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_TABLE = 'ppp_schema_migrations';

/** Errores MySQL/MariaDB que indican “ya estaba aplicado”. */
const IDEMPOTENT_ERR_CODES = new Set([
  'ER_DUP_FIELDNAME', // 1060 columna ya existe
  'ER_TABLE_EXISTS_ERROR', // 1050 tabla ya existe
  'ER_DUP_KEYNAME', // 1061 índice ya existe
  'ER_DUP_ENTRY', // 1062 unique ya existe (ej. índice unique)
]);

@Injectable()
export class SqlMigrationsRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(SqlMigrationsRunner.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    // Nunca tumbar el API por una migración: log fuerte y seguir sirviendo.
    try {
      await this.runAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Migrations failed (API continues): ${message}`);
    }
  }

  private async runAll() {
    // Siempre: columnas críticas del código actual (evita caída si olvidan el flag)
    await this.ensureClientRequestIdColumn();
    await this.ensureProductScheduleSchema();
    await this.ensureWhatsappSchema();
    await this.ensureUserAddressLocationColumns();
    await this.ensureWebDeliverySettingsColumns();
    await this.ensureFactusInvoiceSettingsColumns();
    await this.ensureElectronicInvoiceColumns();
    await this.ensureInvoiceCustomersTable();

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

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const applied = await this.getAppliedNames();
    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      const fullPath = join(dir, file);
      const sql = readFileSync(fullPath, 'utf8');

      // DELIMITER es sintaxis del cliente mysql (procedures); no ejecutable por driver.
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
          } catch (stmtErr: unknown) {
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`✗ ${file}: ${message}`);
        throw err;
      }
    }

    this.logger.log(
      ran === 0
        ? 'Migrations up to date'
        : `Applied ${ran} migration(s)`,
    );
  }

  /**
   * Idempotencia de órdenes: la entidad ya usa client_request_id.
   * Se aplica siempre al boot para no tumbar la API si no corrieron migrations.
   */
  /** Columnas FE Factus en ppp_orders — críticas: sin ellas /orders/daily cae. */
  private async ensureElectronicInvoiceColumns() {
    try {
      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_orders'`,
      );
      if (Number(table?.[0]?.c) === 0) return;

      const cols: Array<{ name: string; ddl: string }> = [
        {
          name: 'electronic_invoice_status',
          ddl: "VARCHAR(20) NOT NULL DEFAULT 'none'",
        },
        { name: 'electronic_invoice_reference', ddl: 'VARCHAR(64) NULL' },
        { name: 'electronic_invoice_number', ddl: 'VARCHAR(64) NULL' },
        { name: 'electronic_invoice_cufe', ddl: 'VARCHAR(128) NULL' },
        { name: 'electronic_invoice_public_url', ddl: 'VARCHAR(500) NULL' },
        { name: 'electronic_invoice_qr_url', ddl: 'VARCHAR(500) NULL' },
        { name: 'electronic_invoice_issued_at', ddl: 'TIMESTAMP NULL' },
        { name: 'electronic_invoice_error', ddl: 'VARCHAR(1000) NULL' },
        { name: 'invoice_customer_doc_type', ddl: 'VARCHAR(5) NULL' },
        { name: 'invoice_customer_doc_number', ddl: 'VARCHAR(20) NULL' },
        { name: 'invoice_customer_doc_dv', ddl: 'VARCHAR(1) NULL' },
        { name: 'electronic_credit_note_number', ddl: 'VARCHAR(64) NULL' },
        { name: 'electronic_credit_note_cufe', ddl: 'VARCHAR(128) NULL' },
        { name: 'electronic_credit_note_public_url', ddl: 'VARCHAR(500) NULL' },
        { name: 'electronic_credit_note_issued_at', ddl: 'TIMESTAMP NULL' },
      ];

      for (const col of cols) {
        const rows: { c: number }[] = await this.dataSource.query(
          `SELECT COUNT(*) AS c
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ppp_orders'
             AND COLUMN_NAME = ?`,
          [col.name],
        );
        if (Number(rows?.[0]?.c) > 0) continue;
        this.logger.warn(`Missing ppp_orders.${col.name} — adding now`);
        await this.dataSource.query(
          `ALTER TABLE ppp_orders ADD COLUMN ${col.name} ${col.ddl}`,
        );
      }

      // Índices (idempotente)
      for (const idx of [
        {
          name: 'idx_ppp_orders_einvoice_status',
          sql: 'CREATE INDEX idx_ppp_orders_einvoice_status ON ppp_orders (electronic_invoice_status)',
        },
        {
          name: 'idx_ppp_orders_einvoice_number',
          sql: 'CREATE INDEX idx_ppp_orders_einvoice_number ON ppp_orders (electronic_invoice_number)',
        },
      ]) {
        const exists: { c: number }[] = await this.dataSource.query(
          `SELECT COUNT(*) AS c
           FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ppp_orders'
             AND INDEX_NAME = ?`,
          [idx.name],
        );
        if (Number(exists?.[0]?.c) > 0) continue;
        try {
          await this.dataSource.query(idx.sql);
        } catch (err: unknown) {
          if (!this.isIdempotentError(err)) throw err;
        }
      }
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure electronic invoice columns: ${message}`);
    }
  }

  /** Clientes fiscales FE (autocomplete). */
  private async ensureInvoiceCustomersTable() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS ppp_invoice_customers (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          identification_document_code VARCHAR(5) NOT NULL,
          identification VARCHAR(20) NOT NULL,
          dv VARCHAR(1) NULL,
          legal_organization_code VARCHAR(1) NOT NULL,
          names VARCHAR(150) NULL,
          company VARCHAR(150) NULL,
          email VARCHAR(255) NULL,
          phone VARCHAR(20) NULL,
          address VARCHAR(250) NULL,
          municipality_code VARCHAR(10) NULL,
          times_used INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_invoice_customer_doc (identification_document_code, identification)
        )
      `);
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure ppp_invoice_customers: ${message}`);
    }
  }

  private async ensureClientRequestIdColumn() {
    try {
      const rows: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_orders'
           AND COLUMN_NAME = 'client_request_id'`,
      );
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
      } catch (idxErr: unknown) {
        if (!this.isIdempotentError(idxErr)) throw idxErr;
      }
      this.logger.log('✓ ppp_orders.client_request_id ready');
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure client_request_id: ${message}`);
      throw err;
    }
  }

  /** Pin de mapa en direcciones guardadas del usuario. */
  private async ensureUserAddressLocationColumns() {
    try {
      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_user_addresses'`,
      );
      if (Number(table?.[0]?.c) === 0) return;

      const cols: Array<{ name: string; ddl: string }> = [
        { name: 'lat', ddl: 'DECIMAL(10,7) NULL' },
        { name: 'lng', ddl: 'DECIMAL(10,7) NULL' },
        {
          name: 'location_confirmed',
          ddl: 'TINYINT(1) NOT NULL DEFAULT 0',
        },
      ];

      for (const col of cols) {
        const rows: { c: number }[] = await this.dataSource.query(
          `SELECT COUNT(*) AS c
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ppp_user_addresses'
             AND COLUMN_NAME = ?`,
          [col.name],
        );
        if (Number(rows?.[0]?.c) > 0) continue;
        this.logger.warn(`Missing ppp_user_addresses.${col.name} — adding now`);
        await this.dataSource.query(
          `ALTER TABLE ppp_user_addresses ADD COLUMN ${col.name} ${col.ddl}`,
        );
      }
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure user address location columns: ${message}`);
    }
  }

  /** Domicilio web (checkout): tramos por km en ppp_restaurant_settings. */
  private async ensureWebDeliverySettingsColumns() {
    try {
      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_restaurant_settings'`,
      );
      if (Number(table?.[0]?.c) === 0) return;

      const cols: Array<{ name: string; ddl: string }> = [
        { name: 'web_delivery_default_fee', ddl: 'INT NOT NULL DEFAULT 4000' },
        { name: 'web_delivery_max_km', ddl: 'DECIMAL(6,2) NULL DEFAULT 6.00' },
        { name: 'web_delivery_fee_tiers', ddl: 'JSON NULL' },
      ];

      for (const col of cols) {
        const rows: { c: number }[] = await this.dataSource.query(
          `SELECT COUNT(*) AS c
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ppp_restaurant_settings'
             AND COLUMN_NAME = ?`,
          [col.name],
        );
        if (Number(rows?.[0]?.c) > 0) continue;
        this.logger.warn(`Missing ppp_restaurant_settings.${col.name} — adding now`);
        await this.dataSource.query(
          `ALTER TABLE ppp_restaurant_settings ADD COLUMN ${col.name} ${col.ddl}`,
        );
      }
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure web delivery settings columns: ${message}`);
    }
  }

  /** Impuestos FE configurables desde admin (SaaS). */
  private async ensureFactusInvoiceSettingsColumns() {
    try {
      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_restaurant_settings'`,
      );
      if (Number(table?.[0]?.c) === 0) return;

      const cols: Array<{ name: string; ddl: string }> = [
        { name: 'factus_item_taxes', ddl: 'JSON NULL' },
        { name: 'factus_prices_include_tax', ddl: 'TINYINT(1) NULL' },
      ];

      for (const col of cols) {
        const rows: { c: number }[] = await this.dataSource.query(
          `SELECT COUNT(*) AS c
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'ppp_restaurant_settings'
             AND COLUMN_NAME = ?`,
          [col.name],
        );
        if (Number(rows?.[0]?.c) > 0) continue;
        this.logger.warn(`Missing ppp_restaurant_settings.${col.name} — adding now`);
        await this.dataSource.query(
          `ALTER TABLE ppp_restaurant_settings ADD COLUMN ${col.name} ${col.ddl}`,
        );
      }
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure factus invoice settings columns: ${message}`);
    }
  }

  /** Horarios por producto: la entidad ya usa has_schedule + ppp_product_schedules. */
  private async ensureProductScheduleSchema() {
    try {
      const col: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_products'
           AND COLUMN_NAME = 'has_schedule'`,
      );
      if (Number(col?.[0]?.c) === 0) {
        this.logger.warn('Missing column ppp_products.has_schedule — adding now');
        await this.dataSource.query(`
          ALTER TABLE ppp_products
          ADD COLUMN has_schedule TINYINT(1) NOT NULL DEFAULT 0
        `);
        this.logger.log('✓ ppp_products.has_schedule ready');
      }

      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_product_schedules'`,
      );
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
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure product schedule schema: ${message}`);
      throw err;
    }
  }

  private async ensureWhatsappSchema() {
    try {
      const table: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_settings'`,
      );
      if (Number(table?.[0]?.c) > 0) {
        // Alinear domicilio por defecto a $2.000 si quedó en 0
        await this.dataSource.query(
          `UPDATE ppp_whatsapp_settings
           SET default_delivery_fee = 2000
           WHERE id = 1 AND (default_delivery_fee IS NULL OR default_delivery_fee = 0)`,
        );
        await this.ensureWhatsappSettingsColumns();
        await this.ensureWhatsappMessageColumns();
        await this.ensureWhatsappConversationColumns();
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
      await this.ensureWhatsappMessageColumns();
      await this.ensureWhatsappConversationColumns();
      this.logger.log('✓ WhatsApp schema ready');
    } catch (err: unknown) {
      if (this.isIdempotentError(err)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to ensure WhatsApp schema: ${message}`);
      throw err;
    }
  }

  /** Columnas de contexto del local para la IA (idempotente). */
  private async ensureWhatsappSettingsColumns() {
    const cols: Array<{ name: string; ddl: string }> = [
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
      { name: 'max_order_amount', ddl: 'INT NOT NULL DEFAULT 0' },
      { name: 'max_units_per_item', ddl: 'INT NOT NULL DEFAULT 10' },
      { name: 'max_total_units', ddl: 'INT NOT NULL DEFAULT 0' },
      { name: 'max_cart_lines', ddl: 'INT NOT NULL DEFAULT 0' },
      { name: 'handoff_when_max_exceeded', ddl: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'large_order_handoff_message', ddl: 'TEXT NULL' },
      { name: 'allergens_note', ddl: 'TEXT NULL' },
      { name: 'promotions_note', ddl: 'TEXT NULL' },
      { name: 'service_area_note', ddl: 'TEXT NULL' },
      { name: 'cash_change_note', ddl: 'TEXT NULL' },
      { name: 'transfer_info_note', ddl: 'TEXT NULL' },
      { name: 'special_requests_note', ddl: 'TEXT NULL' },
      { name: 'ask_order_notes', ddl: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'rate_limit_per_minute', ddl: 'INT NOT NULL DEFAULT 25' },
      { name: 'human_agent_idle_minutes', ddl: 'INT NOT NULL DEFAULT 30' },
      { name: 'human_client_idle_minutes', ddl: 'INT NOT NULL DEFAULT 120' },
      { name: 'order_draft_idle_minutes', ddl: 'INT NOT NULL DEFAULT 45' },
      { name: 'pending_choice_idle_minutes', ddl: 'INT NOT NULL DEFAULT 15' },
      { name: 'mp_payment_idle_minutes', ddl: 'INT NOT NULL DEFAULT 60' },
      { name: 'session_idle_notify', ddl: 'TINYINT(1) NOT NULL DEFAULT 1' },
      { name: 'app_secret', ddl: 'TEXT NULL' },
      { name: 'payment_methods', ddl: 'JSON NULL' },
      { name: 'menu_concept_groups', ddl: 'JSON NULL' },
      { name: 'payment_instructions', ddl: 'TEXT NULL' },
      { name: 'hours_note', ddl: 'TEXT NULL' },
      { name: 'cancel_policy_note', ddl: 'TEXT NULL' },
      { name: 'human_handoff_message', ddl: 'TEXT NULL' },
      { name: 'closed_message', ddl: 'TEXT NULL' },
      { name: 'menu_link_message', ddl: 'TEXT NULL' },
      { name: 'order_success_message', ddl: 'TEXT NULL' },
      { name: 'ai_temperature', ddl: 'DECIMAL(3,2) NULL DEFAULT 0.20' },
      { name: 'delivery_fee_mode', ddl: "VARCHAR(20) NOT NULL DEFAULT 'route_tiers'" },
      { name: 'restaurant_lat', ddl: 'DECIMAL(10, 7) NULL' },
      { name: 'restaurant_lng', ddl: 'DECIMAL(10, 7) NULL' },
      { name: 'delivery_max_km', ddl: 'DECIMAL(6, 2) NULL DEFAULT 5.50' },
      { name: 'delivery_fee_tiers', ddl: 'JSON NULL' },
    ];
    for (const col of cols) {
      const exists: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_settings'
           AND COLUMN_NAME = ?`,
        [col.name],
      );
      if (Number(exists?.[0]?.c) > 0) continue;
      await this.dataSource.query(
        `ALTER TABLE ppp_whatsapp_settings ADD COLUMN ${col.name} ${col.ddl}`,
      );
      this.logger.log(`✓ WhatsApp settings column added: ${col.name}`);
    }

    // Seed domicilio por ruta (Dg. 6b #78b-20) si coords/tramos están vacíos
    await this.dataSource.query(`
      UPDATE ppp_whatsapp_settings
      SET
        restaurant_lat = COALESCE(restaurant_lat, 4.6323019),
        restaurant_lng = COALESCE(restaurant_lng, -74.1471957),
        restaurant_address = COALESCE(NULLIF(TRIM(restaurant_address), ''), 'Dg. 6b #78b-20, Bogotá'),
        restaurant_city = COALESCE(NULLIF(TRIM(restaurant_city), ''), 'Bogotá'),
        maps_url = COALESCE(
          NULLIF(TRIM(maps_url), ''),
          'https://www.google.com/maps/place/Dg.+6b+%2378b-20,+Bogot%C3%A1/@4.6323019,-74.1471957,17z'
        ),
        delivery_fee_mode = COALESCE(NULLIF(TRIM(delivery_fee_mode), ''), 'route_tiers'),
        delivery_max_km = COALESCE(delivery_max_km, 5.50),
        delivery_fee_tiers = COALESCE(
          delivery_fee_tiers,
          JSON_ARRAY(
            JSON_OBJECT('maxKm', 2.5, 'fee', 2000),
            JSON_OBJECT('maxKm', 3.5, 'fee', 5000),
            JSON_OBJECT('maxKm', 5.5, 'fee', 6000)
          )
        )
      WHERE id = 1
    `);
  }

  /** media_id / mime_type para audio e imágenes en el inbox admin. */
  private async ensureWhatsappMessageColumns() {
    const table: { c: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'ppp_whatsapp_messages'`,
    );
    if (Number(table?.[0]?.c) === 0) return;

    const cols: Array<{ name: string; ddl: string }> = [
      { name: 'media_id', ddl: 'VARCHAR(128) NULL' },
      { name: 'mime_type', ddl: 'VARCHAR(120) NULL' },
    ];
    for (const col of cols) {
      const exists: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_messages'
           AND COLUMN_NAME = ?`,
        [col.name],
      );
      if (Number(exists?.[0]?.c) > 0) continue;
      await this.dataSource.query(
        `ALTER TABLE ppp_whatsapp_messages ADD COLUMN ${col.name} ${col.ddl}`,
      );
      this.logger.log(`✓ WhatsApp messages column added: ${col.name}`);
    }

    // Índice único para dedupe de webhooks Meta (varios NULL permitidos en MySQL)
    const idx: { c: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'ppp_whatsapp_messages'
         AND INDEX_NAME = 'uq_whatsapp_wa_message_id'`,
    );
    if (Number(idx?.[0]?.c) === 0) {
      try {
        await this.dataSource.query(
          `ALTER TABLE ppp_whatsapp_messages
           ADD UNIQUE INDEX uq_whatsapp_wa_message_id (wa_message_id)`,
        );
        this.logger.log('✓ WhatsApp messages unique index: uq_whatsapp_wa_message_id');
      } catch (err) {
        this.logger.warn(
          `No se pudo crear uq_whatsapp_wa_message_id (puede haber duplicados previos): ${String(err)}`,
        );
      }
    }
  }

  private async ensureWhatsappConversationColumns() {
    const table: { c: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'ppp_whatsapp_conversations'`,
    );
    if (Number(table?.[0]?.c) === 0) return;

    const cols: Array<{ name: string; ddl: string }> = [
      { name: 'human_takeover_at', ddl: 'TIMESTAMP NULL' },
      { name: 'last_human_outbound_at', ddl: 'TIMESTAMP NULL' },
    ];
    for (const col of cols) {
      const exists: { c: number }[] = await this.dataSource.query(
        `SELECT COUNT(*) AS c
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'ppp_whatsapp_conversations'
           AND COLUMN_NAME = ?`,
        [col.name],
      );
      if (Number(exists?.[0]?.c) > 0) continue;
      await this.dataSource.query(
        `ALTER TABLE ppp_whatsapp_conversations ADD COLUMN ${col.name} ${col.ddl}`,
      );
      this.logger.log(`✓ WhatsApp conversations column added: ${col.name}`);
    }
  }

  private isEnabled(): boolean {
    const raw = (this.config.get<string>('RUN_MIGRATIONS') ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  private resolveMigrationsDir(): string | null {
    const candidates = [
      join(process.cwd(), 'migrations'),
      join(__dirname, '..', '..', '..', 'migrations'), // dist/common/migrations → root
      join(__dirname, '..', '..', 'migrations'), // src/common/migrations → src/../migrations unlikely
    ];
    for (const dir of candidates) {
      if (existsSync(dir)) return dir;
    }
    return null;
  }

  private async ensureMigrationsTable() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ppp_schema_migrations_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async getAppliedNames(): Promise<Set<string>> {
    const rows: { name: string }[] = await this.dataSource.query(
      `SELECT name FROM ${MIGRATIONS_TABLE}`,
    );
    return new Set(rows.map((r) => r.name));
  }

  private async markApplied(name: string) {
    await this.dataSource.query(
      `INSERT IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
      [name],
    );
  }

  private splitStatements(sql: string): string[] {
    // Quitar comentarios ANTES de dividir por ';' (un comentario puede contener ';')
    const withoutComments = sql
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('--')) return '';
        return line.replace(/--.*$/, '');
      })
      .join('\n');

    return withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private isIdempotentError(err: unknown): boolean {
    const e = err as { code?: string; errno?: number; message?: string };
    if (e?.code && IDEMPOTENT_ERR_CODES.has(e.code)) return true;
    // errno fallbacks
    if (e?.errno === 1060 || e?.errno === 1050 || e?.errno === 1061) return true;
    const msg = String(e?.message ?? err).toLowerCase();
    return (
      msg.includes('duplicate column') ||
      msg.includes('already exists') ||
      msg.includes('duplicate key name')
    );
  }
}
