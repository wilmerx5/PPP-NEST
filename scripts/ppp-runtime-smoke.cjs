// Runs inside the candidate image against a disposable, network-isolated CI DB.
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { databaseTransport } = require('./dist/common/database-transport');

function database() {
  assert.equal(process.env.DB_HOST, 'ppp-smoke-db');
  assert.equal(process.env.DB_DATABASE, 'ppp_runtime_smoke');
  assert.equal(process.env.PPP_STAGING, 'true');
  return new DataSource({
    type: 'mariadb', host: process.env.DB_HOST, port: 3306,
    username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE, entities: ['/app/dist/**/*.entity.js'],
    synchronize: false, logging: false,
    ...databaseTransport(process.env.DB_SSL_ENABLED, process.env.DB_SSL_CA),
  });
}

async function health(expected) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (response.status === expected) {
        assert.equal(body.status, expected === 200 ? 'ok' : 'degraded');
        assert.equal(body.db, expected === 200 ? 'connected' : 'disconnected');
        console.log(`PASS runtime health ${expected}`);
        return;
      }
    } catch (error) {
      if (error?.code === 'ERR_ASSERTION') throw error;
    }
    await delay(1000);
  }
  throw new Error(`Health did not reach HTTP ${expected}`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'seed') {
    const db = database();
    try {
      await db.initialize();
      const rows = await db.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
      assert.ok(rows[0]?.Value, 'Fixture connection must use TLS');
      // Only this guarded disposable fixture creates tables from entity metadata.
      // The application itself continues to use synchronize:false.
      await db.synchronize();
      console.log('PASS disposable schema and verified TLS');
    } finally { if (db.isInitialized) await db.destroy(); }
  } else if (mode === 'untrusted-tls') {
    const db = database();
    let rejected = false;
    try { await db.initialize(); }
    catch (error) { rejected = /certificate|self.signed|issuer/i.test(String(error?.message)); }
    finally { if (db.isInitialized) await db.destroy(); }
    assert.ok(rejected, 'The private CA must not be trusted when it is omitted');
    console.log('PASS untrusted DB certificate rejected');
  } else if (mode === 'healthy' || mode === 'degraded') {
    await health(mode === 'healthy' ? 200 : 503);
  } else if (mode === 'http-guards') {
    const admin = await fetch('http://127.0.0.1:3000/api/admin/whatsapp/settings');
    assert.equal(admin.status, 401, 'Settings must require authentication');
    const webhook = await fetch('http://127.0.0.1:3000/api/whatsapp/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(webhook.status, 401, 'Unsigned webhook must be rejected');
    assert.equal((await webhook.json()).error, 'invalid_signature');
    console.log('PASS runtime admin authentication and webhook signature guards');
  } else { throw new Error('Unknown runtime smoke mode'); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
