import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrdersService } from '../src/orders/orders.service';
import { ProductsService } from '../src/products/products.service';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { OrderItemAttribute } from '../src/orders/entities/order-item-attribute.entity';
import { OrderExtra } from '../src/orders/entities/order-extra.entity';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/products/entities/category.entity';
import { ProductAttribute } from '../src/products/entities/product-attribute.entity';
import { ProductVariantStock } from '../src/products/entities/product-variant-stock.entity';
import { ProductSchedule } from '../src/products/entities/product-schedule.entity';
import { InventoryGroup } from '../src/products/entities/inventory-group.entity';
import { InventoryGroupItem } from '../src/products/entities/inventory-group-item.entity';
import { InventorySelection } from '../src/products/entities/inventory-selection.entity';
import { InventorySelectionProduct } from '../src/products/entities/inventory-selection-product.entity';
import { User } from '../src/auth/entities/user.entity';
import { UserPoints } from '../src/auth/entities/user-points.entity';
import { Address } from '../src/auth/entities/address.entity';
import { Phone } from '../src/auth/entities/phone.entity';
import { VerificationToken } from '../src/auth/entities/verification-token.entity';
import { WhatsappSettings } from '../src/whatsapp/entities/whatsapp-settings.entity';
import { getZonedClock } from '../src/business/business-clock';

import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { SqlMigrationsRunner } from '../src/common/migrations/sql-migrations.runner';
import { WhatsappConversation } from '../src/whatsapp/entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../src/whatsapp/entities/whatsapp-message.entity';
import { WhatsappConversationService } from '../src/whatsapp/whatsapp-conversation.service';
import { WhatsappSettingsService } from '../src/whatsapp/whatsapp-settings.service';
import { WhatsappCatalogService } from '../src/whatsapp/whatsapp-catalog.service';
import { WhatsappActionGuardService } from '../src/whatsapp/whatsapp-action-guard.service';
import { WhatsappOrchestratorService } from '../src/whatsapp/whatsapp-orchestrator.service';
import { WhatsappWebhookController } from '../src/whatsapp/whatsapp-webhook.controller';
import { WhatsappMetaService } from '../src/whatsapp/whatsapp-meta.service';
import { WhatsappRateLimitService } from '../src/whatsapp/whatsapp-rate-limit.service';
import { WhatsappTurnTelemetryService } from '../src/whatsapp/whatsapp-turn-telemetry.service';
import { WhatsappPointsService } from '../src/whatsapp/whatsapp-points.service';
import type { AiOrderAction, WhatsappSessionData } from '../src/whatsapp/types/whatsapp-session.types';

// Only local throwaway DBs. Never load DB_* staging credentials or AppModule.
if(process.env.WHATSAPP_DB_TEST!=='1'||!['127.0.0.1','localhost','::1'].includes(process.env.TEST_DB_HOST||'')||
 !/^ppp_test_whatsapp(?:_[a-z0-9]+)?$/.test(process.env.TEST_DB_DATABASE||''))throw new Error('Full checkout requires loopback throwaway PPP DB');
const entities=[Order,OrderItem,OrderItemAttribute,OrderExtra,Product,Category,ProductAttribute,
  ProductVariantStock,ProductSchedule,InventoryGroup,InventoryGroupItem,InventorySelection,
  InventorySelectionProduct,User,UserPoints,Address,Phone,VerificationToken,WhatsappSettings,WhatsappConversation,WhatsappMessage];
function connection(){return new DataSource({type:'mariadb',host:process.env.TEST_DB_HOST,port:Number(process.env.TEST_DB_PORT||3306),
 username:process.env.TEST_DB_USERNAME,password:process.env.TEST_DB_PASSWORD,database:process.env.TEST_DB_DATABASE,
 entities,synchronize:false,timezone:'Z',logging:false,extra:{connectionLimit:12,connectTimeout:10000}});}

describe('Signed WhatsApp confirmation into real PPP orders, inventory and kitchen event',()=>{
 let db:DataSource,otherDb:DataSource,app:INestApplication;
 let orders:OrdersService,inventory:ProductsService,catalog:WhatsappCatalogService,orchestrator:WhatsappOrchestratorService;
 let conversations:WhatsappConversationService,other:WhatsappConversationService;
 let send:jest.SpyInstance,finalize:jest.SpyInstance,external:jest.SpyInstance;
 let cfg:any;
 let gateway:{emitOrdersUpdates:jest.Mock};
 let agent:{runTurn:jest.Mock};
 const secret='synthetic-full-checkout-signature';
 const settings={getEffectiveConfig:async()=>cfg};
 const business={getClock:async()=>getZonedClock('America/Bogota'),assertAcceptingOnlineOrders:async()=>{},
  getStatus:async()=>({isOpen:true,message:'synthetic open',openTime:'00:00',closeTime:'23:59'})};
 const breaker={execute:async(fn:()=>Promise<unknown>)=>fn()};
 function service(ds:DataSource){const s=new WhatsappConversationService(ds.getRepository(WhatsappConversation),ds.getRepository(WhatsappMessage),{} as never,{} as never);
  jest.spyOn(s,'findUserByPhone').mockResolvedValue(null);return s;}
 function post(id:string,text='confirmar',phone='573000000001'){
  const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'synthetic-channel'},
   messages:[{from:phone,id,timestamp:'1',type:'text',text:{body:text}}]}}]}]});
  const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  return request(app.getHttpServer()).post('/whatsapp/webhook').set('Content-Type','application/json').set('x-hub-signature-256',signature).send(raw);
 }
 async function ready(cart:WhatsappSessionData['cart'],phone='573000000001',state='building_cart'){
  const c=await conversations.findOrCreateConversation(phone,'+'+phone);await conversations.updateCustomerName(c,'Cliente Sintético');
  await conversations.saveSession(c,{cart,orderType:'pickup',fulfillmentChosen:true,address:'Recoge en el local',addressConfirmed:true,
   phoneConfirmed:true,paymentMethod:'cash',notesCollected:true},state as never);return c;
 }
 async function apply(text:string,actions:AiOrderAction,cart:WhatsappSessionData['cart']=[]){
  const products=await catalog.getMenuProducts();
  const guarded=new WhatsappActionGuardService(catalog).sanitize({actions,products,businessOpen:true,allowMercadoPago:false});
  return ((await (orchestrator as any).applyActions({}, {cart,orderType:'pickup'},guarded.actions,products,cfg,text)).session as WhatsappSessionData).cart;
 }
 async function saved(){return otherDb.getRepository(Order).findOneOrFail({where:{orderSource:'whatsapp'},relations:['items','items.product','items.attributes','extras']});}
 async function stock(id:number){return Number((await otherDb.getRepository(Product).findOneByOrFail({id})).stock);}
 async function settled(){await Promise.all(finalize.mock.results.map(r=>r.value));}
 beforeAll(async()=>{
  external=jest.spyOn(global,'fetch').mockImplementation(async()=>{throw new Error('External calls forbidden in full internal checkout');});
  db=connection();await db.initialize();await db.synchronize();
  await (new SqlMigrationsRunner(new ConfigService({RUN_MIGRATIONS:'false'}),db) as any).ensureWhatsappSchema();
  otherDb=connection();await otherDb.initialize();
 });
 beforeEach(async()=>{
  for(const entity of [WhatsappMessage,WhatsappConversation,Order,InventoryGroup,Product,Category])await db.getRepository(entity).createQueryBuilder().delete().execute();
  const category=await db.getRepository(Category).save({name:'synthetic PPP catalog'});
  await db.getRepository(Product).save([
   {id:1,code:1,name:'1 Pollo Frito',price:41000,isActive:true,trackInventory:true,stock:10,hasAttributes:true,categories:[category]},
   {id:23,code:23,name:'Arroz Con Pollo',price:29500,isActive:true,trackInventory:true,stock:10,hasAttributes:false,categories:[category]},
   {id:37,code:37,name:'Limonada Natural',price:4500,isActive:true,trackInventory:false,stock:0,hasAttributes:false,categories:[category]},
  ]);
  await db.getRepository(ProductAttribute).save({product:{id:1},attributeName:'Arepas',options:JSON.stringify(['Blancas','Fritas','Sin arepas'])});
  await db.getRepository(WhatsappSettings).save({id:1,ignoreBusinessHours:false});
  cfg={...await new WhatsappSettingsService(db.getRepository(WhatsappSettings),new ConfigService()).getEffectiveConfig(),
   enabled:true,agentV1Enabled:true,appSecret:secret,rateLimitPerMinute:500};
  gateway={emitOrdersUpdates:jest.fn()};
  agent={runTurn:jest.fn().mockResolvedValue({reply:'Listo, conservé los otros productos. ¿Algo más?',actions:{},toolCalls:[]})};
  inventory=new ProductsService(db.getRepository(Product),db.getRepository(Category),db.getRepository(ProductAttribute),db.getRepository(ProductVariantStock),
   db.getRepository(InventoryGroup),db.getRepository(InventoryGroupItem),db.getRepository(InventorySelection),db.getRepository(InventorySelectionProduct),db.getRepository(ProductSchedule),
   {get:()=>undefined,set:()=>{}} as never,breaker as never,business as never);
  orders=new OrdersService(db.getRepository(Order),db.getRepository(OrderItem),db.getRepository(OrderItemAttribute),db.getRepository(OrderExtra),db.getRepository(Product),
   db.getRepository(User),gateway as never,db,{calculatePointsFromCodes:()=>0,getPointCodesByOrderId:async()=>[],invalidatePointsForCanceledOrder:async()=>{}} as never,
   inventory,business as never,{} as never,{} as never,breaker as never,{} as never);
  // Spy without replacing the real post-commit mapper and kitchen event.
  finalize=jest.spyOn(orders as any,'finalizeOrderAfterCreate');
  catalog=new WhatsappCatalogService(inventory);conversations=service(db);other=service(otherDb);
  const meta=new WhatsappMetaService(settings as never);send=jest.spyOn(meta,'sendText').mockResolvedValue(undefined);
  orchestrator=new WhatsappOrchestratorService(settings as never,meta,catalog,{} as never,conversations,business as never,orders,
   {createPreference:async()=>{throw new Error('Cash tests must not initiate online payments');}} as never,new WhatsappActionGuardService(catalog),
   new WhatsappPointsService({} as never),{} as never,agent as never,new WhatsappTurnTelemetryService());
  const module=await Test.createTestingModule({controllers:[WhatsappWebhookController],providers:[
   {provide:WhatsappSettingsService,useValue:settings},{provide:WhatsappMetaService,useValue:meta},{provide:WhatsappOrchestratorService,useValue:orchestrator},
   {provide:WhatsappConversationService,useValue:conversations},{provide:WhatsappRateLimitService,useValue:new WhatsappRateLimitService()},
  ]}).compile();app=module.createNestApplication({rawBody:true});await app.init();
 });
 afterEach(async()=>{await settled();await app?.close();expect(external).not.toHaveBeenCalled();});
 afterAll(async()=>{external?.mockRestore();if(otherDb?.isInitialized)await otherDb.destroy();if(db?.isInitialized)await db.destroy();});

 it.each(['cash','transfer'])('starts with an empty conversation and collects %s checkout data before creating exactly two units',async payment=>{
  const phone='573000000001';
  agent.runTurn.mockResolvedValueOnce({reply:'Listo, dos arroces con pollo sin ensalada.',
   actions:{addItems:[{productId:23,quantity:2,note:'sin ensalada'}]},toolCalls:['add_item']});
  await post('wamid.empty.add','Quiero dos arroces con pollo sin ensalada',phone).expect(200);
  await post('wamid.empty.add','Quiero dos arroces con pollo sin ensalada',phone).expect(200);
  const c=await conversations.findOrCreateConversation(phone,'+'+phone);
  expect(other.getSession(await other.reloadConversation(c.id)).cart).toMatchObject([{productId:23,quantity:2,note:'sin ensalada'}]);
  await post('wamid.empty.checkout','No más',phone).expect(200);
  const answers:Record<string,string>={awaiting_name:'Cliente Sintético',awaiting_phone:'3000000001',
   awaiting_fulfillment:'Paso a recoger',awaiting_address:'Paso a recoger',awaiting_notes:'No',awaiting_payment:payment==='transfer'?'Transferencia':'Efectivo'};
  const visited:string[]=[];
  for(let step=0;step<8;step++){
   const current=await other.reloadConversation(c.id);visited.push(current.state);
   expect(await otherDb.getRepository(Order).count()).toBe(0);
   expect(other.getSession(current).cart.reduce((sum,line)=>sum+line.quantity,0)).toBe(2);
   if(current.state==='awaiting_final_confirm')break;
   expect(answers[current.state]).toBeDefined();
   await post('wamid.empty.data.'+step,answers[current.state],phone).expect(200);
  }
  expect(visited).toContain('awaiting_final_confirm');
  await post('wamid.empty.confirm','Confirmar',phone).expect(200);
  await post('wamid.empty.confirm','Confirmar',phone).expect(200);
  await settled();
  expect(await otherDb.getRepository(Order).count()).toBe(1);
  const order=await saved();expect(order.items).toHaveLength(2);
  expect(order.address).toMatch(payment==='transfer'?/transferencia/i:/contraentrega|efectivo/i);
  expect(order.items.map(item=>item.note)).toEqual(['sin ensalada','sin ensalada']);
  expect(order.items.reduce((sum,item)=>sum+Number(item.unitPrice),0)).toBe(59000);
  expect(await stock(23)).toBe(8);
  expect(gateway.emitOrdersUpdates.mock.calls.filter(call=>call[0]==='created_order')).toHaveLength(1);
  expect((await other.reloadConversation(c.id)).state).toBe('completed');
 });

 it('stores all units, independent variants and notes, and emits the real kitchen payload',async()=>{
  const cart=await apply('Dos pollos fritos con arepas blancas, un pollo frito con arepas fritas, dos arroces con pollo sin ensalada y una limonada',{
   addItems:[{productId:1,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
    {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]},
    {productId:23,quantity:2,note:'sin ensalada'},{productId:37,quantity:1}]});
  const c=await ready(cart);await post('wamid.full.summary').expect(200);expect(await db.getRepository(Order).count()).toBe(0);
  await post('wamid.full.submit').expect(200);await settled();const order=await saved();
  expect(order.items).toHaveLength(6);expect(order.items.filter(i=>i.product.id===1&&i.attributes.some(a=>a.attributeValue==='Blancas'))).toHaveLength(2);
  expect(order.items.filter(i=>i.product.id===1&&i.attributes.some(a=>a.attributeValue==='Fritas'))).toHaveLength(1);
  expect(order.items.filter(i=>i.product.id===23).map(i=>i.note)).toEqual(['sin ensalada','sin ensalada']);
  expect(order.items.reduce((sum,i)=>sum+Number(i.unitPrice),0)).toBe(186500);expect(await stock(1)).toBe(7);expect(await stock(23)).toBe(8);
  const kitchen=gateway.emitOrdersUpdates.mock.calls.filter(call=>call[0]==='created_order');
  expect(kitchen).toHaveLength(1);
  expect(kitchen[0][1].orderId).toBe(order.id);
  expect(kitchen[0][1].items.find(i=>i.productId===1)).toMatchObject({quantity:3,price:41000});
  expect(kitchen[0][1].items.find(i=>i.productId===1).variants.map(v=>v.attributes.Arepas).sort()).toEqual(['Blancas','Blancas','Fritas']);
  expect(kitchen[0][1].items.find(i=>i.productId===23).variants.map(v=>v.note)).toEqual(['sin ensalada','sin ensalada']);
  expect((await other.reloadConversation(c.id)).state).toBe('completed');expect(other.getSession(await other.reloadConversation(c.id)).cart).toEqual([]);
 });
 it('applies removal and quantity corrections before the actual checkout',async()=>{
  let cart=await apply('Tres arroces con pollo y dos limonadas',{addItems:[{productId:23,quantity:3},{productId:37,quantity:2}]});
  cart=await apply('Deja solo un arroz con pollo sin ensalada y quita las limonadas',{removeProductIds:[23,37],addItems:[{productId:23,quantity:1,note:'sin ensalada'}]},cart);
  await ready(cart);await post('wamid.edited.summary').expect(200);await post('wamid.edited.submit').expect(200);
  const order=await saved();expect(order.items).toHaveLength(1);expect(order.items[0].note).toBe('sin ensalada');expect(await stock(23)).toBe(9);
 });
 it('keeps repeated Meta IDs and additional confirmations from duplicating the real order',async()=>{
  await ready(await apply('Dos arroces con pollo',{addItems:[{productId:23,quantity:2}]}));
  await post('wamid.retry.summary').expect(200);await post('wamid.retry.submit').expect(200);
  await post('wamid.retry.submit').expect(200);await post('wamid.retry.new-confirm').expect(200);await settled();
  expect(await db.getRepository(Order).count()).toBe(1);expect(await db.getRepository(OrderItem).count()).toBe(2);expect(await stock(23)).toBe(8);
  expect(gateway.emitOrdersUpdates.mock.calls.filter(call=>call[0]==='created_order')).toHaveLength(1);
 });
 it('does not duplicate an accepted real order after the reply transport fails',async()=>{
  const c=await ready(await apply('Un arroz con pollo',{addItems:[{productId:23}]}),'573000000001','awaiting_final_confirm');
  send.mockRejectedValue(new Error('synthetic Meta send outage'));await post('wamid.commit-no-reply').expect(200);
  expect(await db.getRepository(Order).count()).toBe(1);expect((await other.reloadConversation(c.id)).state).toBe('completed');
  send.mockResolvedValue(undefined);await post('wamid.commit-no-reply').expect(200);await post('wamid.commit-new-retry').expect(200);
  expect(await db.getRepository(Order).count()).toBe(1);expect(await stock(23)).toBe(9);
 });
 it('retains the cart after stock runs out and accepts one fresh retry after replenishment',async()=>{
  const c=await ready(await apply('Un arroz con pollo',{addItems:[{productId:23}]}));await post('wamid.stock.summary').expect(200);
  await db.getRepository(Product).update(23,{stock:0});await post('wamid.stock.rejected').expect(200);
  expect(await db.getRepository(Order).count()).toBe(0);expect(other.getSession(await other.reloadConversation(c.id)).cart).toHaveLength(1);
  await db.getRepository(Product).update(23,{stock:5});await post('wamid.stock.retry').expect(200);
  expect(await db.getRepository(Order).count()).toBe(1);expect(await stock(23)).toBe(4);
 });
 it('rejects a product disabled after the menu was cached',async()=>{
  const c=await ready(await apply('Un arroz con pollo',{addItems:[{productId:23}]}));await post('wamid.disabled.summary').expect(200);
  await db.getRepository(Product).update(23,{isActive:false});await post('wamid.disabled.submit').expect(200);
  expect(await db.getRepository(Order).count()).toBe(0);expect(await stock(23)).toBe(10);
  expect(other.getSession(await other.reloadConversation(c.id)).cart).toHaveLength(1);
 });
 it('requires review of a changed catalog price before committing the order',async()=>{
  const c=await ready(await apply('Un pollo frito',{addItems:[{productId:1}]}));await post('wamid.price.summary').expect(200);
  await db.getRepository(Product).update(1,{price:43000});await post('wamid.price.changed').expect(200);
  expect(await db.getRepository(Order).count()).toBe(0);expect(await stock(1)).toBe(10);
  const fresh=await other.reloadConversation(c.id);expect(fresh.state).toBe('awaiting_final_confirm');expect(other.getSession(fresh).cart[0].unitPrice).toBe(43000);
  await post('wamid.price.accepted').expect(200);expect(Number((await saved()).items[0].unitPrice)).toBe(43000);expect(await stock(1)).toBe(9);
 });
 it('rolls back a late inventory failure through the webhook and preserves the editable cart',async()=>{
  const c=await ready(await apply('Un arroz con pollo',{addItems:[{productId:23}]}),'573000000001','awaiting_final_confirm');
  jest.spyOn(inventory,'decrementStock').mockRejectedValueOnce(new Error('synthetic late stock fault'));
  await post('wamid.rollback.reject').expect(200);expect(await db.getRepository(Order).count()).toBe(0);
  expect(await db.getRepository(OrderItem).count()).toBe(0);expect(await stock(23)).toBe(10);
  expect(other.getSession(await other.reloadConversation(c.id)).cart).toHaveLength(1);
  await post('wamid.rollback.retry').expect(200);expect(await db.getRepository(Order).count()).toBe(1);expect(await stock(23)).toBe(9);
 });
 it('turns two different customer confirmations into distinct orders and daily numbers',async()=>{
  const cart=await apply('Un arroz con pollo',{addItems:[{productId:23}]});
  await ready(cart,'573000000001','awaiting_final_confirm');await ready(cart,'573000000002','awaiting_final_confirm');
  await Promise.all([post('wamid.customer.a').expect(200),post('wamid.customer.b','confirmar','573000000002').expect(200)]);
  const rows=await otherDb.getRepository(Order).find();expect(rows).toHaveLength(2);expect(new Set(rows.map(r=>r.dailyOrderNumber)).size).toBe(2);expect(await stock(23)).toBe(8);
 });
 it('routes a signed note edit into one variant, persistence and the real kitchen mapper',async()=>{
  const cart=await apply('Dos pollos con arepas blancas y un pollo con arepas fritas',{
   addItems:[{productId:1,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
    {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]}]});
  const c=await ready(cart);
  agent.runTurn.mockResolvedValueOnce({reply:'Listo, los de arepas blancas van sin salsa.',
   actions:{updateCartLines:[{productId:1,cartLineIndex:0,note:'sin salsa'}]},toolCalls:['update_item']});
  await post('wamid.http.edit.note','A los pollos de arepas blancas ponles sin salsa. El de arepas fritas déjalo igual').expect(200);
  expect(agent.runTurn).toHaveBeenCalledTimes(1);
  const persisted=other.getSession(await other.reloadConversation(c.id)).cart;
  expect(persisted.find(l=>l.attributes?.some(a=>a.attributeValue==='Blancas'))).toMatchObject({quantity:2,note:'sin salsa'});
  expect(persisted.find(l=>l.attributes?.some(a=>a.attributeValue==='Fritas'))?.note).toBeFalsy();
  expect(await db.getRepository(Order).count()).toBe(0);
  await post('wamid.http.note.summary').expect(200);await post('wamid.http.note.submit').expect(200);await settled();
  const order=await saved();expect(order.items).toHaveLength(3);expect(await stock(1)).toBe(7);
  const kitchen=gateway.emitOrdersUpdates.mock.calls.find(call=>call[0]==='created_order')[1];
  expect(kitchen.items[0].variants.filter(v=>v.attributes.Arepas==='Blancas').map(v=>v.note)).toEqual(['sin salsa','sin salsa']);
  expect(kitchen.items[0].variants.find(v=>v.attributes.Arepas==='Fritas').note).toBeNull();
 });
 it('removes only the selected preparation through signed inbound and preserves the other units',async()=>{
  const cart=await apply('Dos pollos con arepas blancas y un pollo con arepas fritas',{
   addItems:[{productId:1,quantity:2,attributes:[{attributeName:'Arepas',attributeValue:'Blancas'}]},
    {productId:1,quantity:1,attributes:[{attributeName:'Arepas',attributeValue:'Fritas'}]}]});
  const c=await ready(cart);
  agent.runTurn.mockResolvedValueOnce({reply:'Listo, quedan los dos de arepas blancas.',
   actions:{removeCartLines:[{productId:1,cartLineIndex:1}]},toolCalls:['remove_item']});
  await post('wamid.http.remove.variant','Quita el pollo de arepas fritas y conserva los dos de arepas blancas').expect(200);
  const persisted=other.getSession(await other.reloadConversation(c.id)).cart;
  expect(persisted).toHaveLength(1);expect(persisted[0].quantity).toBe(2);
  expect(persisted[0].attributes).toContainEqual({attributeName:'Arepas',attributeValue:'Blancas'});
  await post('wamid.http.remove.summary').expect(200);await post('wamid.http.remove.submit').expect(200);
  expect((await saved()).items).toHaveLength(2);expect(await stock(1)).toBe(8);
 });
 it('clears only the selected line note before real order creation',async()=>{
  const cart=await apply('Un arroz con pollo sin ensalada y otro arroz con pollo sin cilantro',{addItems:[{productId:23,quantity:1,note:'sin ensalada'},
   {productId:23,quantity:1,note:'sin cilantro'}]});
  const c=await ready(cart);
  agent.runTurn.mockResolvedValueOnce({reply:'Listo, el arroz que iba sin cilantro queda normal.',
   actions:{updateCartLines:[{productId:23,cartLineIndex:1,note:''}]},toolCalls:['update_item']});
  await post('wamid.http.clear.note','El arroz que iba sin cilantro déjalo normal. El de sin ensalada no lo cambies').expect(200);
  const persisted=other.getSession(await other.reloadConversation(c.id)).cart;
  expect(persisted).toHaveLength(2);expect(persisted[0].note).toBe('sin ensalada');expect(persisted[1].note).toBeFalsy();
  await post('wamid.http.clear.summary').expect(200);await post('wamid.http.clear.submit').expect(200);
  expect((await saved()).items.map(i=>i.note||'').sort()).toEqual(['','sin ensalada']);expect(await stock(23)).toBe(8);
 });
 it('answers a menu question without changing the persisted cart or creating an order',async()=>{
  const cart=await apply('Un arroz con pollo',{addItems:[{productId:23}]});const c=await ready(cart);
  agent.runTurn.mockResolvedValueOnce({reply:'La limonada natural vale $4.500. ¿Quieres agregar una?',actions:{},toolCalls:['search_menu']});
  await post('wamid.http.question','¿Cuánto vale una limonada natural?').expect(200);
  expect(other.getSession(await other.reloadConversation(c.id)).cart).toEqual(cart);
  expect(await db.getRepository(Order).count()).toBe(0);expect(await stock(23)).toBe(10);
 });
 it('suppresses editing and checkout while a human has control, then resumes the preserved cart',async()=>{
  const cart=await apply('Un arroz con pollo',{addItems:[{productId:23}]});const c=await ready(cart);
  await db.getRepository(WhatsappConversation).update(c.id,{humanTakeover:true,humanTakeoverAt:new Date(),lastHumanOutboundAt:new Date()});
  await post('wamid.http.takeover.edit','Al arroz ponle sin ensalada').expect(200);await post('wamid.http.takeover.confirm').expect(200);
  expect(agent.runTurn).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();
  expect(other.getSession(await other.reloadConversation(c.id)).cart).toEqual(cart);expect(await db.getRepository(Order).count()).toBe(0);
  await db.getRepository(WhatsappConversation).update(c.id,{humanTakeover:false});
  await post('wamid.http.resume.summary').expect(200);await post('wamid.http.resume.submit').expect(200);
  expect(await db.getRepository(Order).count()).toBe(1);expect(await stock(23)).toBe(9);
 });

});
