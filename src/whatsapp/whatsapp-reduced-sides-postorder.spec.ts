import { harness } from './whatsapp-accuracy.test-support';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';

describe('Reduced accompaniments and delivery timing after real simulated checkout',()=>{
  const menus=[{name:'Churrasco',a:'arroz',b:'ensalada'},{name:'Bowl Vegetal',a:'arroz',b:'salsa'},{name:'Pasta Del Huerto',a:'queso',b:'crema'}];
  for(const f of menus)for(const enabled of [false,true])for(const query of ['cuanto tarda el pedido','¿En cuánto llega mi pedido?','Buenas, cuánto se demora el pedido']){
    it(`${f.name} / ${query} / agent=${enabled}`,async()=>{
      const menu=[{id:86001,code:86001,name:f.name,price:21000,availableNow:true,attributes:[]},...[f.a,f.b].map((name,i)=>({id:86002+i,code:86002+i,name:'Porcion De '+name,price:5000,availableNow:true,attributes:[]}))];
      const h=harness(menu,enabled);
      h.cfg.paymentMethods=DEFAULT_PAYMENT_METHODS.map(p=>({...p,enabled:p.flow!=='mercadopago'}));
      h.cfg.localContext={deliveryTimeNote:'40–50 minutos'};
      Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:8600,dailyOrderNumber:96});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([{id:8600,dailyOrderNumber:96,orderStatus:'pending'}]);
      const reply=await h.sendQueued(`un ${f.name.toLowerCase()} con poquito ${f.a} y poquita ${f.b}`);
      expect(reply).not.toMatch(/no manejamos|no tenemos/i);
      expect(h.cartRows()).toEqual([expect.objectContaining({id:86001,qty:1,note:expect.stringContaining(`poquito ${f.a}`)})]);
      expect(h.cartRows()[0].note).toContain(`poquita ${f.b}`);
      await h.sendQueued('Calle 10 #20-30');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      await h.sendQueued('confirmar');expect(h.conv.state).toBe('completed');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(86001);
      expect(dto.items[0].note).toContain(`poquita ${f.b}`);
      const before=structuredClone(h.conv.sessionData);
      const start=h.replies.length;
      await h.sendQueued(query);
      const answer=h.replies.slice(start).join('\n');
      expect(answer).toContain('#96');expect(answer).toContain('40–50 minutos');
      expect(answer).not.toMatch(/no tenemos productos|no manejamos|qu[eé] se te antoja|algo m[aá]s/i);
      expect(h.conv.state).toBe('completed');expect(h.conv.sessionData).toEqual(before);
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.service.ordersService.findTodayOrdersByPhone).toHaveBeenCalledWith(h.conv.phoneE164);
    });
  }
});
