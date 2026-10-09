import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { WhatsappConversation } from '../src/whatsapp/entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../src/whatsapp/entities/whatsapp-message.entity';
import { WhatsappSettings } from '../src/whatsapp/entities/whatsapp-settings.entity';

// This command never imports AppModule or runs application/bootstrap migrations.
async function main() {
  const required=['DB_HOST','DB_PORT','DB_USERNAME','DB_PASSWORD','DB_DATABASE'];
  if(process.env.PPP_STAGING_DB_AUDIT!=='1' || required.some(key=>!process.env[key])) {
    throw new Error('Select PPP_STAGING_DB_AUDIT=1 and configure all five DB_* staging secrets.');
  }
  const db=new DataSource({type:'mariadb',host:process.env.DB_HOST,port:Number(process.env.DB_PORT),
    username:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE,
    entities:[WhatsappConversation,WhatsappMessage,WhatsappSettings],synchronize:false,migrationsRun:false,logging:false,
    ssl:{rejectUnauthorized:true,...(process.env.DB_SSL_CA ? {ca:process.env.DB_SSL_CA} : {})},
    extra:{connectionLimit:1,connectTimeout:12000}});
  const checks: Array<{name:string;pass:boolean;detail?:unknown}>=[];
  let transactionStarted=false;
  try {
    await db.initialize();
    await db.query('START TRANSACTION READ ONLY');transactionStarted=true;
    const version=await db.query('SELECT VERSION() AS version');
    const cipher=await db.query("SHOW STATUS LIKE 'Ssl_cipher'");
    checks.push({name:'encrypted_connection',pass:Boolean(cipher[0]?.Value)});
    for(const entity of [WhatsappSettings,WhatsappConversation,WhatsappMessage]) {
      const metadata=db.getMetadata(entity);
      const columns=await db.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[metadata.tableName]);
      const found=new Set(columns.map((r:{name:string})=>r.name));
      const missing=metadata.columns.map(c=>c.databaseName).filter(name=>!found.has(name));
      checks.push({name:'columns:'+metadata.tableName,pass:missing.length===0,detail:{missing}});
    }
    const indexes=await db.query("SELECT INDEX_NAME AS name, COLUMN_NAME AS col, NON_UNIQUE AS non_unique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ppp_whatsapp_messages' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
    const grouped=new Map<string,any[]>();for(const row of indexes)grouped.set(row.name,[...(grouped.get(row.name)||[]),row]);
    checks.push({name:'unique_meta_message_id',pass:[...grouped.values()].some(rows=>rows.length===1 && rows[0].col==='wa_message_id' && Number(rows[0].non_unique)===0)});
    const tables=await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    const names=new Set(tables.map((r:{name:string})=>r.name));
    for(const name of ['ppp_products','ppp_orders','ppp_order_items'])checks.push({name:'table:'+name,pass:names.has(name)});
    if(names.has('ppp_products')) {
      const [catalog]=await db.query('SELECT COUNT(*) AS products, SUM(is_active=1) AS active, SUM(price IS NULL OR price<0) AS invalid_prices FROM ppp_products');
      checks.push({name:'usable_catalog',pass:Number(catalog.active)>0 && Number(catalog.invalid_prices)===0,detail:catalog});
    }
    if(checks.find(c=>c.name==='columns:ppp_whatsapp_messages')?.pass) {
      const lifecycle=await db.query("SELECT processing_status AS status, COUNT(*) AS count FROM ppp_whatsapp_messages WHERE direction='in' GROUP BY processing_status");
      checks.push({name:'inbound_lifecycle_observed',pass:true,detail:lifecycle});
    }
    const pass=checks.every(c=>c.pass);
    console.log(JSON.stringify({audit:'PPP staging read-only',version:version[0]?.version,pass,checks},null,2));
    if(!pass)process.exitCode=1;
  } finally {
    if(transactionStarted)await db.query('ROLLBACK');
    if(db.isInitialized)await db.destroy();
  }
}
main().catch((err:unknown)=> {
  // Do not emit connection config, credentials, settings rows or customer data.
  const e=err as {code?:string;errno?:number};
  console.error(JSON.stringify({audit:'PPP staging read-only',pass:false,error:{code:e?.code||'AUDIT_FAILED',errno:e?.errno}}));
  process.exitCode=1;
});
