import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappActionGuardService } from './whatsapp-action-guard.service';
import { WhatsappPointsService } from './whatsapp-points.service';
import { WhatsappTurnTelemetryService } from './whatsapp-turn-telemetry.service';
import type { WhatsappSessionData } from './types/whatsapp-session.types';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
import { isHypotheticalOrderQuestion, looksLikeAddressOnlyMessage, orderBeforeCheckoutClose } from './whatsapp-intent';
import { isWrongChatApology, isCartChargeQuestion } from './whatsapp-session-intents';
import { products, harness } from './whatsapp-accuracy.test-support';


describe('Desistimiento y compra nueva — mensaje compuesto o ráfaga',()=>{
  const alt=[
    {id:12201,code:12201,name:'Bowl Mediterraneo',price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Base',options:['Arroz','Quinoa']}]},
    {id:12202,code:12202,name:'Taco Al Pastor',price:12000,availableNow:true,hasAttributes:false,attributes:[]},
  ];
  for(const f of [
    {menu:products,newText:'dos churrascos sin ensalada',newId:17,oldText:'Un pollo frito',oldId:1,note:/sin ensalada/i},
    {menu:alt,newText:'dos bowls mediterraneos con quinoa sin cebolla',newId:12201,oldText:'Un taco al pastor',oldId:12202,note:/sin cebolla/i},
  ].flatMap(f=>[false,true].map(agentEnabled=>({...f,agentEnabled})))) for(const phrase of [
    {apology:'Disculpa, me equivoqué de chat.',lead:'Ahora sí quiero '},
    {apology:'Perdón, ese mensaje era para otra tienda.',lead:'Pero dame '},
    {apology:'Me equivoqué de número.',lead:'Aquí quiero '},
  ]) for(const oldCart of [false,true]) for(const mode of ['mensaje','rafaga','rafagaCompleta']) {
    it(f.newId+' '+phrase.lead+' previo='+oldCart+' '+mode+' agent='+f.agentEnabled,async()=>{
      const h=harness(f.menu,f.agentEnabled);
      if(oldCart) await h.sendQueued(f.oldText);
      const before=structuredClone(h.cartRows());
      await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
      if(!f.agentEnabled) expect(h.conv.sessionData.pendingMultiOrder).toBeTruthy();
      const replyStart=h.replies.length;
      if(mode==='mensaje')await h.sendQueued(phrase.apology+' '+phrase.lead+f.newText);
      else{
        jest.useFakeTimers();try{
          const texts=mode==='rafagaCompleta'?['Hola buenas noches, me envías por favor una libra de arroz, dos aceites y un kilo de azúcar',phrase.apology,phrase.lead+f.newText]:[phrase.apology,phrase.lead+f.newText];
          const messages=texts.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:'apology-burst-'+i,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
          await jest.advanceTimersByTimeAsync(4000);await Promise.all(messages);
        }finally{jest.useRealTimers();}
      }
      expect(h.cartRows()).toHaveLength(before.length+1);
      expect(h.cartRows()).toEqual(expect.arrayContaining([...before,expect.objectContaining({id:f.newId,qty:2,note:expect.stringMatching(f.note)})]));
      if(f.newId===12201) expect(h.cartRows().find(row=>row.id===f.newId)?.attrs).toContain('Base:Quinoa');
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      const output=h.replies.slice(replyStart).join(' ');
      expect(output).not.toMatch(/libra de arroz|aceites|az[uú]car|no es un pedido ni una direcci[oó]n/i);
    });
  }
  for(const f of [
    {menu:products,name:'Churrasco',oldText:'Un pollo frito'},
    {menu:alt,name:'Bowl Mediterraneo',oldText:'Un taco al pastor'},
  ]) for(const oldCart of [false,true]) for(const kind of ['precio','descripcion']) {
    it('después del desistimiento consulta '+kind+' de '+f.name+' previo='+oldCart,async()=>{
      const h=harness(f.menu,false);
      if(oldCart) await h.sendQueued(f.oldText);
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued('Una libra de arroz, dos aceites y un kilo de azúcar');
      const ask=kind==='precio'?'cuánto cuesta '+f.name:'qué trae '+f.name;
      const reply=await h.sendQueued('Disculpa, me equivoqué de chat. Ahora sí quiero saber '+ask+'?');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMultiOrder).toBeFalsy();
      expect(reply).toContain(f.name);
      expect(reply).not.toMatch(/aceites|libra de arroz|az[uú]car|no es un pedido ni una direcci[oó]n/i);
    });
  }

});
