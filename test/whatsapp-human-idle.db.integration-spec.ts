import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { WhatsappConversation } from '../src/whatsapp/entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../src/whatsapp/entities/whatsapp-message.entity';
import { WhatsappConversationService } from '../src/whatsapp/whatsapp-conversation.service';

if (process.env.WHATSAPP_DB_TEST !== '1' || process.env.TEST_DB_HOST !== '127.0.0.1' ||
    process.env.TEST_DB_DATABASE !== 'ppp_test_whatsapp_387') {
  throw new Error('Requires explicit isolated loopback ppp_test_whatsapp_387 database');
}

describe('387: real MariaDB conditional human release', () => {
 const db = new DataSource({type:'mariadb',host:'127.0.0.1',port:Number(process.env.TEST_DB_PORT),username:process.env.TEST_DB_USERNAME,password:process.env.TEST_DB_PASSWORD,database:'ppp_test_whatsapp_387',entities:[WhatsappConversation,WhatsappMessage],synchronize:true,timezone:'Z'});
 let service:WhatsappConversationService;
 beforeAll(async()=>{await db.initialize();service=new WhatsappConversationService(db.getRepository(WhatsappConversation),db.getRepository(WhatsappMessage),{} as never,{} as never);});
 afterAll(async()=>{if(db.isInitialized)await db.destroy();});
 async function fixture(state='completed') {
  const old=new Date(Date.now()-60*60000);
  return db.getRepository(WhatsappConversation).save({waId:'offline-387',phoneE164:'offline-387',state,humanTakeover:true,humanTakeoverAt:old,lastHumanOutboundAt:old,lastInboundAt:old,sessionData:{cart:[{productId:7,quantity:1}],address:'synthetic address'}});
 }
 it.each(['completed','building_cart'])('preserves session and state %s and cannot repeat',async state=>{
  const saved=await fixture(state);expect(await service.releaseIdleHumanTakeover(saved.id,15)).toBe(true);
  const live=await service.reloadConversation(saved.id);expect(live.state).toBe(state);expect(live.sessionData).toEqual(saved.sessionData);expect(live.humanTakeover).toBe(false);expect(await service.releaseIdleHumanTakeover(saved.id,15)).toBe(false);
 });
 it.each(['last_inbound_at','last_human_outbound_at','human_takeover_at'])('fresh %s protects against stale selection',async column=>{
  const saved=await fixture();await db.query(`UPDATE ppp_whatsapp_conversations SET ${column} = NOW() WHERE id = ?`,[saved.id]);
  expect(await service.releaseIdleHumanTakeover(saved.id,15)).toBe(false);const live=await service.reloadConversation(saved.id);expect(live.humanTakeover).toBe(true);expect(live.sessionData).toEqual(saved.sessionData);
  expect((await service.findClientIdleTakeovers(15)).some(row=>row.id===saved.id)).toBe(false);
 });
 it('concurrent cleaners cannot release twice',async()=>{const saved=await fixture();const result=await Promise.all([service.releaseIdleHumanTakeover(saved.id,15),service.releaseIdleHumanTakeover(saved.id,15)]);expect(result.sort()).toEqual([false,true]);});
 it('disabled cleanup is a no-op',async()=>{const saved=await fixture();expect(await service.releaseIdleHumanTakeover(saved.id,0)).toBe(false);expect((await service.reloadConversation(saved.id)).humanTakeover).toBe(true);});
});
