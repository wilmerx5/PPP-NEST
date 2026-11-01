import {harness} from './whatsapp-accuracy.test-support';

for(const family of ['Ejecutivo Con Pollo','Bandeja Con Tofu']) for(const agent of [false,true]) {
  for(const mode of ['fragmented','burst','switch','switch-unavailable','switch-ambiguous','switch-repeat','switch-note']) it(`${family}: ${mode}; agent=${agent}`,async()=>{
    const protein=family.includes('Pollo')?'pollo':'tofu';
    const head=family.split(' ')[0].toLowerCase();
    const attrs=[{attributeName:'Presa',options:['Pierna Pernil','Pechuga']},{attributeName:'Sopa',options:['Ajiaco','Mondongo (Fines de semana)']},{attributeName:'Bebida',options:['Colombiana','Coca Cola']}];
    const menu=[
      {id:95301,code:1,name:family+' Frito',price:24000,availableNow:true,hasAttributes:true,attributes:attrs},
      {id:95302,code:2,name:family+' Broaster',price:25000,availableNow:true,hasAttributes:true,attributes:attrs},
      {id:95303,code:3,name:'1 '+protein+' Broaster',price:43000,availableNow:true,attributes:[]},
    ];
    const h=harness(menu,agent);
    h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
    h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cuál prefieres?',actions:{}});
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:329,dailyOrderNumber:329});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    if(mode==='burst') {
      jest.useFakeTimers();
      try {
        const pending=[`Buenas tardes me regala ${head}`,`${protein} broaster`,'pierna pernil'].map((text,i)=>h.service.handleIncoming({waId:'customer',phoneE164:h.conv.phoneE164,messageId:`meal-${i}`,messageType:'text',text,timestamp:Date.now()/1000,raw:{}}));
        await jest.advanceTimersByTimeAsync(4000);
        await Promise.all(pending);
      } finally {jest.useRealTimers();}
      const awaitingDrink=!!h.conv.sessionData.pendingAttribute;
      await h.sendQueued('Mondongo');
      if(awaitingDrink) {
        expect(h.conv.sessionData.cart).toHaveLength(0);
        expect(h.conv.sessionData.pendingAttribute?.selected).toEqual(expect.arrayContaining([{attributeName:'Sopa',attributeValue:'Mondongo (Fines de semana)'}]));
        expect(h.conv.sessionData.pendingAttribute?.selected.some(value=>value.attributeName==='Bebida')).toBe(false);
      }
      await h.sendQueued('y coca cola');
    } else if(mode==='fragmented') {
      await h.sendQueued(`Buenas tardes me regala ${head}`);
      await h.sendQueued(`${protein} broaster`);
      await h.sendQueued('pierna pernil');
      const awaitingDrink=!!h.conv.sessionData.pendingAttribute;
      await h.sendQueued('Mondongo');
      if(awaitingDrink) {
        expect(h.conv.sessionData.cart).toHaveLength(0);
        expect(h.conv.sessionData.pendingAttribute?.selected).toEqual(expect.arrayContaining([{attributeName:'Sopa',attributeValue:'Mondongo (Fines de semana)'}]));
        expect(h.conv.sessionData.pendingAttribute?.selected.some(value=>value.attributeName==='Bebida')).toBe(false);
      }
      await h.sendQueued('y coca cola');
    } else {
      await h.sendQueued(`un ${family} frito pierna pernil con mondongo y coca cola`);
      if(mode==='switch-unavailable') menu[1].availableNow=false;
      if(mode==='switch-ambiguous') h.conv.sessionData.cart.push({...structuredClone(h.conv.sessionData.cart[0]),note:'Sin sal'});
      if(mode==='switch-note') h.conv.sessionData.cart[0].note='Sin sal';
      const before=structuredClone(h.conv.sessionData.cart);
      await h.sendQueued(`el ${head} lo quiero con ${protein} broaster`);
      if(mode==='switch-unavailable' || mode==='switch-ambiguous') {
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.replies.at(-1)).toMatch(/igual/);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
        return;
      }
      if(mode==='switch-repeat') {
        const changed=structuredClone(h.conv.sessionData.cart);
        await h.sendQueued(`el ${head} lo quiero con ${protein} broaster`);
        expect(h.conv.sessionData.cart).toEqual(changed);
        expect(h.replies.at(-1)).toMatch(/ya tiene/);
      }
      if(mode==='switch-note') expect(h.conv.sessionData.cart[0].note).toBe('Sin sal');
    }
    expect(h.conv.sessionData.cart).toHaveLength(1);
    expect(h.conv.sessionData.cart[0]).toMatchObject({productId:95302,quantity:1,attributes:expect.arrayContaining([
      {attributeName:'Presa',attributeValue:'Pierna Pernil'},
      {attributeName:'Sopa',attributeValue:'Mondongo (Fines de semana)'},
      {attributeName:'Bebida',attributeValue:'Coca Cola'},
    ])});
    expect(h.conv.sessionData.cart[0].note||'').not.toMatch(/Sopa:|Bebida:|Presa:/);
    await h.sendQueued('no mas');
    await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    const receipt=await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0]).toMatchObject({productId:95302,attributes:expect.arrayContaining([
      {attributeName:'Sopa',attributeValue:'Mondongo (Fines de semana)'},
      {attributeName:'Bebida',attributeValue:'Coca Cola'},
    ])});
    if(mode==='switch-note') expect(dto.items[0].note).toBe('Sin sal');
    expect(receipt).toContain('25.000');
    expect(receipt).toContain('Coca Cola');
    expect(receipt).not.toMatch(/Colombiana|Ajiaco/);
  });
}
