import { harness } from './whatsapp-accuracy.test-support';

// 31/10: address/contact turns duplicated a dish or introduced an unrelated tray.
for (const name of ['1/2 Pollo Broaster', 'Bowl Vegetal'])
  for (const hostileAgent of [false, true])
    for (const mode of ['separate', 'contact-burst', 'repeat-contact', 'different-address', 'different-unit']) {
      it(`${name}: ${mode}, hostile agent=${hostileAgent}`, async () => {
        const h=harness([
          {id:95101,code:1,name,price:18000,availableNow:true,attributes:[]},
          {id:95102,code:2,name:'Bandeja Especial',price:22000,availableNow:true,attributes:[]},
        ],hostileAgent);
        h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
        h.service.ordersService.create=jest.fn().mockResolvedValue({id:327,dailyOrderNumber:327});
        h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
        Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
        await h.sendQueued(`Me envías un ${name} por favor`);
        expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:95101,quantity:1})]);
        const before=structuredClone(h.conv.sessionData.cart);
        if(hostileAgent) {
          const unsafe={reply:'Listo, agregué otro plato',actions:{addItems:[{productId:95101,quantity:1},{productId:95102,quantity:1}]},toolCalls:['add_item']};
          h.agent.runTurn.mockResolvedValue(unsafe);
          h.service.aiService.generateTurn.mockResolvedValue(unsafe);
        }
        const contact=['Calle 10 #20-30','Torre 2 apto 402','300 111 2233'];
        if(mode==='contact-burst') {
          jest.useFakeTimers();
          try {
            const pending=contact.map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`contact-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
            await jest.advanceTimersByTimeAsync(4000);
            await Promise.all(pending);
          } finally {jest.useRealTimers();}
        } else {
          for(const text of contact) {
            await h.sendQueued(text);
            expect(h.conv.sessionData.cart).toEqual(before);
          }
          if(mode==='repeat-contact') {
            await h.sendQueued(contact[0]);
            await h.sendQueued(contact[2]);
          }
        }
        if(mode==='different-address') await h.sendQueued('Cambia la dirección a Carrera 22 #40-50');
        if(mode==='different-unit') await h.sendQueued('Calle 10 #20-30 torre 3 apto 900');
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.address).toContain(mode==='different-address'?'40-50':'20-30');
        if(mode==='different-address') expect(h.conv.sessionData.address).not.toContain('402');
        else expect(h.conv.sessionData.address).toContain(mode==='different-unit'?'900':'402');
        if(mode==='different-unit') expect(h.conv.sessionData.address).not.toContain('402');
        expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
        expect(h.conv.state).toBe('awaiting_payment');
        expect(h.replies.at(-1)).not.toMatch(/agregué otro plato|Bandeja Especial/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        await h.sendQueued('Contraentrega');
        expect(h.conv.state).toBe('awaiting_final_confirm');
        const receipt=await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(1);
        expect(dto.items[0].productId).toBe(95101);
        expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');
        expect(dto.address).toContain(mode==='different-address'?'40-50':mode==='different-unit'?'900':'402');
        expect(receipt).toContain('20.000');
        expect(receipt).not.toContain('Bandeja Especial');
      });
    }
