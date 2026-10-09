import 'reflect-metadata';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { SqlMigrationsRunner } from '../src/common/migrations/sql-migrations.runner';
import { WhatsappConversation } from '../src/whatsapp/entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../src/whatsapp/entities/whatsapp-message.entity';
import { WhatsappSettings } from '../src/whatsapp/entities/whatsapp-settings.entity';
import { WhatsappConversationService } from '../src/whatsapp/whatsapp-conversation.service';
import { WhatsappSettingsService } from '../src/whatsapp/whatsapp-settings.service';
import { WhatsappCatalogService } from '../src/whatsapp/whatsapp-catalog.service';
import { WhatsappActionGuardService } from '../src/whatsapp/whatsapp-action-guard.service';
import { WhatsappOrchestratorService } from '../src/whatsapp/whatsapp-orchestrator.service';
import { WhatsappWebhookController } from '../src/whatsapp/whatsapp-webhook.controller';
import { WhatsappMetaService } from '../src/whatsapp/whatsapp-meta.service';
import { WhatsappRateLimitService } from '../src/whatsapp/whatsapp-rate-limit.service';

// Destructive cleanup is allowed only in an explicitly selected local throwaway database.
if (process.env.WHATSAPP_DB_TEST !== '1' ||
  !['127.0.0.1', 'localhost', '::1'].includes(process.env.TEST_DB_HOST || '') ||
  !/^ppp_test_whatsapp(?:_[a-z0-9]+)?$/.test(process.env.TEST_DB_DATABASE || '')) {
  throw new Error('DB integration requires WHATSAPP_DB_TEST=1, loopback TEST_DB_HOST and a ppp_test_whatsapp database. Never use production credentials.');
}

const products = JSON.parse(readFileSync(join(__dirname, '../scripts/fixtures/whatsapp-beta-menu.json'), 'utf8'));
const catalog = new WhatsappCatalogService({} as never);
const secret = 'synthetic-webhook-secret';
const settings = { getEffectiveConfig: async () => ({enabled:false, appSecret:secret, verifyToken:'synthetic-verify', rateLimitPerMinute:500}) };
function dataSource() {
  return new DataSource({type:'mariadb', host:process.env.TEST_DB_HOST, port:Number(process.env.TEST_DB_PORT || 3306),
    username:process.env.TEST_DB_USERNAME, password:process.env.TEST_DB_PASSWORD, database:process.env.TEST_DB_DATABASE,
    entities:[WhatsappConversation,WhatsappMessage,WhatsappSettings], synchronize:false, timezone:'Z', logging:false,
    extra:{connectionLimit:8,connectTimeout:10000}});
}

describe('WhatsApp real MariaDB persistence and signed HTTP webhook (isolated transports)', () => {
  let primary: DataSource;
  let secondary: DataSource;
  let service: WhatsappConversationService;
  let other: WhatsappConversationService;
  let runner: SqlMigrationsRunner;
  let app: INestApplication;
  let meta: WhatsappMetaService;
  let send: jest.SpyInstance;
  let externalFetch: jest.SpyInstance;

  function conversationService(ds: DataSource) {
    const result=new WhatsappConversationService(ds.getRepository(WhatsappConversation),ds.getRepository(WhatsappMessage),{} as never,{} as never);
    // User-profile lookup is a boundary outside this suite; conversation/message repos are real.
    jest.spyOn(result,'findUserByPhone').mockResolvedValue(null);
    return result;
  }
  async function conversation(waId='573000000001') {
    return primary.getRepository(WhatsappConversation).save({waId,phoneE164:'+'+waId,sessionData:{cart:[],orderType:'pickup'}});
  }
  function payload(id='wamid.synthetic',text='hola') {
    return {object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'test-channel'},
      messages:[{from:'573000000001',id,timestamp:'1',type:'text',text:{body:text}}]}}]}]};
  }
  function post(body: unknown, valid=true) {
    const raw=JSON.stringify(body);
    const signature='sha256='+createHmac('sha256',valid ? secret : 'wrong-secret').update(raw).digest('hex');
    return request(app.getHttpServer()).post('/whatsapp/webhook').set('Content-Type','application/json')
      .set('x-hub-signature-256',signature).send(raw);
  }

  beforeAll(async()=> {
    externalFetch=jest.spyOn(global,'fetch').mockImplementation(async()=> {throw new Error('External network calls are forbidden in DB integration');});
    primary=dataSource();secondary=dataSource();
    await primary.initialize();
    runner=new SqlMigrationsRunner(new ConfigService({RUN_MIGRATIONS:'false'}),primary);
    await (runner as any).ensureWhatsappSchema();
    await secondary.initialize();
  });
  beforeEach(async()=> {
    await primary.query('DELETE FROM ppp_whatsapp_messages');
    await primary.query('DELETE FROM ppp_whatsapp_conversations');
    service=conversationService(primary);other=conversationService(secondary);
    meta=new WhatsappMetaService(settings as never);
    send=jest.spyOn(meta,'sendText').mockResolvedValue(undefined);
    const orchestrator=new WhatsappOrchestratorService(settings as never,meta,catalog,{} as never,service,
      {} as never,{} as never,{} as never,new WhatsappActionGuardService(catalog),{} as never,{} as never,{} as never,{} as never);
    const module=await Test.createTestingModule({controllers:[WhatsappWebhookController],providers:[
      {provide:WhatsappSettingsService,useValue:settings},{provide:WhatsappMetaService,useValue:meta},
      {provide:WhatsappOrchestratorService,useValue:orchestrator},{provide:WhatsappConversationService,useValue:service},
      {provide:WhatsappRateLimitService,useValue:new WhatsappRateLimitService()},
    ]}).compile();
    app=module.createNestApplication({rawBody:true});await app.init();
  });
  afterEach(async()=> {await app?.close();expect(externalFetch).not.toHaveBeenCalled();});
  afterAll(async()=> {await app?.close();if(secondary?.isInitialized)await secondary.destroy();if(primary?.isInitialized)await primary.destroy();externalFetch?.mockRestore();});

  it('bootstraps a readable settings schema with migrations disabled',async()=> {
    const configured=new WhatsappSettingsService(primary.getRepository(WhatsappSettings),new ConfigService());
    const row=await configured.getSettings();expect(row.id).toBe(1);expect(row.agentV1Enabled).toBe(false);
  });
  it('can apply the actual WhatsApp schema bootstrap twice',async()=> {
    await (runner as any).ensureWhatsappSchema();await (runner as any).ensureWhatsappSchema();
    const rows=await primary.query("SHOW INDEX FROM ppp_whatsapp_messages WHERE Key_name='uq_whatsapp_wa_message_id'");
    expect(rows).toHaveLength(1);expect(Number(rows[0].Non_unique)).toBe(0);
  });
  it('creates one conversation when 16 workers race on a previously unseen phone',async()=> {
    let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});let ready=0;
    const workers=Array.from({length:16},(_,i)=>conversationService(i%2 ? primary : secondary));
    for(const worker of workers)jest.spyOn(worker,'findUserByPhone').mockImplementation(async()=> {
      ready++;if(ready===workers.length)release();await barrier;return null;
    });
    const results=await Promise.allSettled(workers.map(worker=>worker.findOrCreateConversation('573000000002','+573000000002')));
    expect(results.filter(result=>result.status==='rejected')).toEqual([]);
    const ids=results.map(result=>result.status==='fulfilled' ? result.value.id : null);
    expect(new Set(ids).size).toBe(1);expect(await primary.getRepository(WhatsappConversation).count()).toBe(1);
  });
  it('allows one winner for 64 simultaneous claims across independent connections',async()=> {
    const conv=await conversation();
    const results=await Promise.all(Array.from({length:64},(_,i)=>(i%2 ? service : other).claimInboundMessage({
      conversationId:conv.id,waMessageId:'wamid.race',body:'dos arroces',raw:{synthetic:true},
    })));
    expect(results.filter(Boolean)).toHaveLength(1);expect(await primary.getRepository(WhatsappMessage).count()).toBe(1);
    expect(results.find(Boolean)?.processingStatus).toBe('processing');
  });
  it('keeps 32 different Meta IDs distinct even when their text is identical',async()=> {
    const conv=await conversation();
    const messages=await Promise.all(Array.from({length:32},(_,i)=>(i%2 ? service : other).claimInboundMessage({
      conversationId:conv.id,waMessageId:'wamid.distinct.'+i,body:'confirmar',
    })));
    expect(messages.filter(Boolean)).toHaveLength(32);expect(await service.countInboundMessages(conv.id)).toBe(32);
  });
  it('refuses a composite unique index that does not enforce global Meta-ID uniqueness',async()=> {
    const conv=await conversation();
    await primary.query('ALTER TABLE ppp_whatsapp_messages DROP INDEX uq_whatsapp_wa_message_id');
    await primary.query('ALTER TABLE ppp_whatsapp_messages ADD UNIQUE INDEX test_composite_claim (conversation_id,wa_message_id)');
    try {
      await expect(conversationService(primary).claimInboundMessage({conversationId:conv.id,waMessageId:'wamid.bad-index',body:'hola'})).rejects.toThrow(/falta un índice UNIQUE/);
      expect(await primary.getRepository(WhatsappMessage).count()).toBe(0);
    } finally {
      await primary.query('ALTER TABLE ppp_whatsapp_messages DROP INDEX test_composite_claim');
      await (runner as any).ensureWhatsappMessageColumns();
    }
  });
  it('does not disguise a foreign-key failure as an already processed message',async()=> {
    await expect(service.claimInboundMessage({conversationId:2147483647,waMessageId:'wamid.no-parent',body:'hola'})).rejects.toThrow();
    expect(await primary.getRepository(WhatsappMessage).count()).toBe(0);
  });
  it('retains nullable IDs for messages that cannot be deduplicated by Meta ID',async()=> {
    const conv=await conversation();
    const a=await service.claimInboundMessage({conversationId:conv.id,body:'hola'});
    const b=await service.claimInboundMessage({conversationId:conv.id,body:'hola'});
    expect(a?.id).not.toBe(b?.id);expect(await service.countInboundMessages(conv.id)).toBe(2);
  });
  it('persists terminal outcomes without reopening completed or failed messages',async()=> {
    const conv=await conversation();
    for(const id of ['wamid.completed','wamid.failed'])await service.claimInboundMessage({conversationId:conv.id,waMessageId:id,body:'hola'});
    await service.setInboundProcessingOutcome(['wamid.completed','wamid.completed'],'completed');
    await service.setInboundProcessingOutcome(['wamid.completed','wamid.failed'],'failed');
    const complete=await other.findByWaMessageId('wamid.completed');const failed=await other.findByWaMessageId('wamid.failed');
    expect(complete?.processingStatus).toBe('completed');expect(complete?.processedAt).toBeInstanceOf(Date);
    expect(failed?.processingStatus).toBe('failed');expect(failed?.processingError).toBe('turn_failed_requires_review');
    await expect(other.claimInboundMessage({conversationId:conv.id,waMessageId:'wamid.failed',body:'retry'})).resolves.toBeNull();
  });
  it('persists actual cart variants, notes and quantities across a second connection',async()=> {
    const conv=await conversation();const cart=Object.create(WhatsappOrchestratorService.prototype) as any;cart.catalogService=catalog;
    const actions=new WhatsappActionGuardService(catalog).sanitize({businessOpen:true,allowMercadoPago:false,products,actions:{addItems:[
      {productId:1,quantity:2,note:'sin salsa',attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
      {productId:1,quantity:1,note:'mucho ají',attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]},
    ]}}).actions;
    const result=await cart.applyActions({},service.getSession(conv),actions,products,{},'Dos pollos fritos con arepas blancas y un pollo frito con arepas fritas');
    await service.saveSession(conv,result.session);
    const actual=other.getSession(await other.reloadConversation(conv.id));
    expect(actual.cart).toEqual(result.session.cart);expect(actual.cart.map(c=>c.quantity)).toEqual([2,1]);
    await service.saveSession(conv,{customerNotes:'Entrega sintética',address:'Dirección de prueba'});
    expect(other.getSession(await other.reloadConversation(conv.id)).cart).toEqual(actual.cart);
  });
  it('does not restore a canceled cart after reloading the conversation',async()=> {
    const conv=await conversation();await service.saveSession(conv,{cart:[{productId:23,code:23,name:'Arroz Con Pollo',quantity:2,unitPrice:29500}],
      orderType:'delivery',address:'Dirección sintética',linkedUserId:'synthetic-user'});
    await service.resetOrderSession(conv,'building_cart',{rememberDeliveryAddress:true});
    const session=other.getSession(await other.reloadConversation(conv.id));
    expect(session.cart).toEqual([]);expect(session.lastDeliveryAddress).toBe('Dirección sintética');expect(session.fulfillmentChosen).toBe(false);
  });
  it('does not restore human takeover when touching an old conversation snapshot',async()=> {
    const conv=await conversation();await primary.getRepository(WhatsappConversation).update(conv.id,{humanTakeover:true});
    const stale=await service.reloadConversation(conv.id);await primary.getRepository(WhatsappConversation).update(conv.id,{humanTakeover:false});
    await service.touchOutbound(stale,'bot');expect((await other.reloadConversation(conv.id)).humanTakeover).toBe(false);
  });
  it('verifies the Meta subscription token through the real HTTP controller',async()=> {
    await request(app.getHttpServer()).get('/whatsapp/webhook').query({'hub.mode':'subscribe','hub.verify_token':'synthetic-verify','hub.challenge':'challenge'}).expect(200,'challenge');
    await request(app.getHttpServer()).get('/whatsapp/webhook').query({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'challenge'}).expect(403);
  });
  it('rejects a forged webhook before writing any conversation or message',async()=> {
    await post(payload(),false).expect(401);expect(await primary.getRepository(WhatsappConversation).count()).toBe(0);
    expect(await primary.getRepository(WhatsappMessage).count()).toBe(0);expect(send).not.toHaveBeenCalled();
  });
  it('runs a signed HTTP inbound through the real coalescer, claim, reply and completion',async()=> {
    await post(payload('wamid.http')).expect(200);
    const inbound=await other.findByWaMessageId('wamid.http');expect(inbound?.processingStatus).toBe('completed');
    expect(send).toHaveBeenCalledTimes(1);expect(await primary.getRepository(WhatsappMessage).count({where:{direction:'out'}})).toBe(1);
    await post(payload('wamid.http')).expect(200);expect(send).toHaveBeenCalledTimes(1);
  });
  it('marks Meta send failure in MariaDB while acknowledging the HTTP webhook',async()=> {
    send.mockRejectedValue(new Error('synthetic transport unavailable'));
    await post(payload('wamid.http.failed')).expect(200);
    expect((await other.findByWaMessageId('wamid.http.failed'))?.processingStatus).toBe('failed');
    expect(await primary.getRepository(WhatsappMessage).count({where:{direction:'out'}})).toBe(0);
    send.mockResolvedValue(undefined);
    await post(payload('wamid.http.recovered')).expect(200);
    expect((await other.findByWaMessageId('wamid.http.recovered'))?.processingStatus).toBe('completed');
    expect((await other.findByWaMessageId('wamid.http.failed'))?.processingStatus).toBe('failed');
  });
  it('handles a failed immediate eight-message batch without an unhandled rejection',async()=> {
    send.mockRejectedValue(new Error('synthetic batch transport unavailable'));
    await Promise.all(Array.from({length:8},(_,i)=>post(payload('wamid.batch.failed.'+i)).expect(200)));
    const messages=await primary.getRepository(WhatsappMessage).find({where:{direction:'in'}});
    expect(messages).toHaveLength(8);expect(messages.every(m=>m.processingStatus==='failed')).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
