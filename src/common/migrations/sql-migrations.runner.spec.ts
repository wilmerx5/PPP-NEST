import { SqlMigrationsRunner } from './sql-migrations.runner';

describe('SqlMigrationsRunner — helpers puros', () => {
  const runner = Object.create(SqlMigrationsRunner.prototype) as any;

  describe('splitStatements', () => {
    it('separa múltiples statements y quita comentarios', () => {
      const sql = `
-- Comentario inicial
ALTER TABLE ppp_orders
ADD COLUMN client_request_id VARCHAR(64) NULL; -- comentario al final

CREATE UNIQUE INDEX uq_x ON ppp_orders (client_request_id);
`;
      const stmts = runner.splitStatements(sql);
      expect(stmts).toHaveLength(2);
      expect(stmts[0]).toContain('ALTER TABLE ppp_orders');
      expect(stmts[0]).not.toContain('--');
      expect(stmts[1]).toContain('CREATE UNIQUE INDEX');
    });

    it('ignora archivos solo con comentarios', () => {
      expect(runner.splitStatements('-- solo comentario\n-- otro\n')).toHaveLength(0);
    });

    it('comentario con ";" adentro NO parte el statement (bug real de 004)', () => {
      const sql = `-- Precio unitario en el momento del pedido.
-- NULL = órdenes antiguas; se usa product.price como fallback.
ALTER TABLE ppp_order_items
ADD COLUMN unit_price DECIMAL(10,2) NULL;
`;
      const stmts = runner.splitStatements(sql);
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toContain('ALTER TABLE ppp_order_items');
      expect(stmts[0]).not.toContain('fallback');
    });
  });

  describe('isIdempotentError', () => {
    it.each([
      ['ER_DUP_FIELDNAME', { code: 'ER_DUP_FIELDNAME' }],
      ['ER_TABLE_EXISTS_ERROR', { code: 'ER_TABLE_EXISTS_ERROR' }],
      ['ER_DUP_KEYNAME', { code: 'ER_DUP_KEYNAME' }],
      ['errno 1060', { errno: 1060 }],
      ['mensaje duplicate column', { message: "Duplicate column name 'client_request_id'" }],
      ['mensaje already exists', { message: "Table 'x' already exists" }],
    ])('trata "%s" como ya-aplicado', (_name, err) => {
      expect(runner.isIdempotentError(err)).toBe(true);
    });

    it('NO trata errores reales como idempotentes', () => {
      expect(runner.isIdempotentError({ code: 'ER_NO_SUCH_TABLE', message: 'Table missing' })).toBe(false);
      expect(runner.isIdempotentError(new Error('ECONNREFUSED'))).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it.each([
      ['true', true],
      ['1', true],
      ['yes', true],
      ['false', false],
      ['', false],
      [undefined, false],
    ])('RUN_MIGRATIONS=%s → %s', (value, expected) => {
      const r = Object.create(SqlMigrationsRunner.prototype) as any;
      r.config = { get: () => value };
      expect(r.isEnabled()).toBe(expected);
    });
  });
});
