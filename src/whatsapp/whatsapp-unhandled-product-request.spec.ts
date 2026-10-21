import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { harness } from './whatsapp-accuracy.test-support';

for (const name of ['Sancocho Trifásico', 'Aguardiente', 'Ramen Vegetal']) {
 for (const enabled of [false,true]) for (const available of [false,true]) for (const occupied of [false,true]) for (const audio of [false,true]) {
  it(`${name} available=${available} occupied=${occupied} audio=${audio} agent=${enabled}`,async()=>{
   const base={id:99101,code:99101,name:'Pizza de Tomate',price:20000,availableNow:true,attributes:[]};
   const requested={id:99102,code:99102,name,price:15000,availableNow:true,attributes:[]};
   const h=harness(available?[base,requested]:[base],enabled);
   h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Qué se te antoja?',actions:{}});
   if(occupied) await h.sendQueued('Quiero una Pizza de Tomate');
   const before=structuredClone(h.conv.sessionData.cart);
   const phrase=audio?`Hola vecino, quiero un ${name}, por favor.`:`un ${name}`;
   h.service.metaService.downloadMedia=jest.fn().mockResolvedValue({buffer:Buffer.from('fixture'),mimeType:'audio/ogg'});
   h.service.aiService.transcribeAudio=jest.fn().mockResolvedValue(phrase);
   h.service.conversationService.updateMessageBody=jest.fn().mockResolvedValue(undefined);
   const start=h.replies.length;
   await h.sendQueued(audio?'':phrase,audio?{messageType:'audio',mediaId:'fixture',mimeType:'audio/ogg'}:{});
   const response=h.replies.slice(start).join('\n');
   if(available){
    expect(h.conv.sessionData.cart.find(i=>i.productId===99102)?.quantity).toBe(1);
    expect(response.toLowerCase()).toContain(name.toLowerCase());
   }else{
    expect(h.conv.sessionData.cart).toEqual(before);
    expect(response).toMatch(/no (?:tenemos|manejamos|está|esta)|no.*carta/i);
    expect(response.toLowerCase()).toContain(name.toLowerCase());
    const retry = await h.sendQueued(`Te acabo de decir que quiero ${name}, por favor.`);
    expect((retry || '').toLowerCase()).toContain(name.toLowerCase());
    expect(retry).toMatch(/no (?:tenemos|manejamos)/i);
    expect(h.conv.sessionData.cart).toEqual(before);
   }
   if(audio)expect(h.service.aiService.transcribeAudio).toHaveBeenCalledTimes(1);
  });
 }
}


describe('plain purchase rejection does not capture other intentions',()=>{
 const catalog=new WhatsappCatalogService({} as never);
 it.each(['quiero un domicilio','quiero un cambio','quiero un pedido','quiero una cuenta',
 'quiero una carta','quiero un menu','quiero otra','quiero un pollo con papas',
 'quiero un pollo y una sopa','quiero uno sin hielo','quiero un humano',
 'quiero una pizza para mañana','un poco de arroz'])('%s',text=>{
  expect(catalog.unavailableSimpleOrderReply(text,[])).toBeNull();
 });
});

it.each(['Mora','Fresa','Guanábana'])('preserves catalog flavor references: %s', flavor=>{
 const catalog=new WhatsappCatalogService({} as never);
 const menu=[{id:99201,code:99201,name:'Jugo De La Casa En Leche',price:7000,availableNow:true,
  hasAttributes:true,attributes:[{attributeName:'Sabor',options:[flavor]}]}];
 expect(catalog.unavailableSimpleOrderReply(`quiero uno de ${flavor} en leche`,menu)).toBeNull();
});
