import { harness } from './whatsapp-accuracy.test-support';

for (const family of ['Ejecutivo Con Pollo Broaster', 'Bandeja Con Tofu Asado'])
  for (const agent of [false,true])
    for (const mode of ['together','separate','two-extra','change-included','included-only']) {
      it(`${family}: ${mode}; agent mock=${agent}`,async()=>{
        const menu=[
          {id:95201,code:1,name:family,price:26000,availableNow:true,hasAttributes:true,attributes:[
            {attributeName:'Sopa',options:['Ajiaco','Mondongo (Fines de semana)','Menudencias']},
            {attributeName:'Bebida',options:['Colombiana','Limonada']},
          ]},
          {id:95202,code:2,name:'Sopa De Menudencias',price:12000,availableNow:true,attributes:[]},
        ];
        const h=harness(menu,agent);
        h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
        h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
        h.service.ordersService.create=jest.fn().mockResolvedValue({id:328,dailyOrderNumber:328});
        h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
        await h.sendQueued(`Me regalas por favor un ${family} mondongo con limonada${mode==='together'?' y una sopa de menudencias veci':''}`);
        if(mode==='separate') await h.sendQueued('una sopa de menudencias');
        if(mode==='two-extra') await h.sendQueued('dos sopa de menudencias');
        if(mode==='change-included') await h.sendQueued('cambia la sopa por menudencias');
        const extra = ['together','separate','two-extra'].includes(mode);
        const quantity = mode==='two-extra' ? 2 : 1;
        const soup = mode==='change-included' ? 'Menudencias' : 'Mondongo (Fines de semana)';
        expect(h.conv.sessionData.cart).toHaveLength(extra ? 2 : 1);
        expect(h.conv.sessionData.cart.find(x=>x.productId===95201)).toMatchObject({quantity:1,attributes:expect.arrayContaining([
          {attributeName:'Sopa',attributeValue:soup},
          {attributeName:'Bebida',attributeValue:'Limonada'},
        ])});
        if(extra) expect(h.conv.sessionData.cart.find(x=>x.productId===95202)).toMatchObject({quantity});
        else expect(h.conv.sessionData.cart.some(x=>x.productId===95202)).toBe(false);
        if(extra) expect(h.replies.join('\n')).not.toMatch(/queda con.*Menudencias/);
        await h.sendQueued('Solo eso porfa');
        await h.sendQueued('Contraentrega');
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        const receipt=await h.sendQueued('Confirmo');
        expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
        const dto=h.service.ordersService.create.mock.calls[0][0];
        expect(dto.items).toHaveLength(extra ? 1+quantity : 1);
        expect(dto.items.find(x=>x.productId===95201).attributes).toEqual(expect.arrayContaining([
          {attributeName:'Sopa',attributeValue:soup},
          {attributeName:'Bebida',attributeValue:'Limonada'},
        ]));
        expect(receipt).toContain(extra ? (quantity===2 ? '50.000' : '38.000') : '26.000');
        expect(receipt).toContain('Limonada');
        expect(receipt).not.toContain('Colombiana');
      });
    }
