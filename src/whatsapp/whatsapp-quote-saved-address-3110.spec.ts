import { harness } from './whatsapp-accuracy.test-support';

// 31/10 export: 12:23 and 13:11, quote acceptance consumed as address reuse.
for (const name of ['1/2 Pollo Broaster', 'Bowl Vegetal'])
  for (const agent of [false, true])
    for (const answer of ['si', 'sí', 'no']) {
      it(`${name}: quote ${answer} with saved address; agent mock=${agent}`, async () => {
        const h = harness([{id:95001,code:1,name,price:18000,availableNow:true,attributes:[]}],agent);
        h.service.aiService.classifyMessage = jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn = jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
        Object.assign(h.conv.sessionData,{orderType:'delivery',lastDeliveryAddress:'Calle 10 #20-30',addressConfirmed:false});
        h.service.ordersService.create=jest.fn().mockResolvedValue({id:326,dailyOrderNumber:326});
        h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
        const quote=await h.sendQueued(`Cuánto cuesta ${name} por favor`);
        expect(quote).toMatch(/agrego|agregar/i);
        expect(h.conv.sessionData.cart).toHaveLength(0);
        expect(h.conv.sessionData.pendingAddOffer).toBeTruthy();
        const reply=await h.sendQueued(answer);
        expect(reply).not.toMatch(/Misma direcci[oó]n|carrito vac[ií]o/i);
        expect(h.conv.sessionData.cart).toHaveLength(answer==='no'?0:1);
        if(answer!=='no') expect(h.conv.sessionData.cart[0]).toMatchObject({productId:95001,quantity:1});
        expect(h.conv.sessionData.addressConfirmed).not.toBe(true);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        expect(h.conv.sessionData.pendingAddOffer).toBeFalsy();
        if(answer!=='no') {
          await h.sendQueued('no más');
          expect(h.conv.state).toBe('awaiting_address');
          await h.sendQueued('si');
          expect(h.conv.sessionData.address).toBe('Calle 10 #20-30');
          expect(h.conv.sessionData.addressConfirmed).toBe(true);
          expect(h.conv.state).toBe('awaiting_payment');
          await h.sendQueued('contraentrega');
          expect(h.service.ordersService.create).not.toHaveBeenCalled();
          const receipt=await h.sendQueued('confirmar');
          expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
          const dto=h.service.ordersService.create.mock.calls[0][0];
          expect(dto.items).toHaveLength(1);
          expect(dto.items[0].productId).toBe(95001);
          expect(dto.address).toContain('20-30');
          expect(receipt).toContain('20.000');
        }
      });
    }
