/** Ambiguous combo offers require a presentation choice and preserve per-candidate options. */
import { writeFileSync } from 'fs';
import { harness } from './whatsapp-accuracy.test-support';
const menus = [
  { key: 'rice', title: 'Arroz Especial Con Medio Pollo', style: 'Frito' },
  { key: 'bowl', title: 'Bowl De Quinoa Con Tofu', style: 'Asado' },
  { key: 'pasta', title: 'Pasta Con Champinones', style: 'Salteados' },
];
const product = (id: number, name: string, price: number, description: string, attributes: {attributeName:string;options:string[]}[]) =>
  ({ id, code:id, name, price, description, attributes, availableNow:true, hasAttributes:attributes.length>0 });
for (const m of menus) for (const agent of [false, true]) {
  const prep={attributeName:'Preparación',options:[m.style,'Normal']};
  const dish=product(99301,m.title,20000,'Incluye ensalada',[prep]);
  const combo=product(99302,`Combo ${m.title}`,26000,'Incluye ensalada y bebida de 400ml',[prep,{attributeName:'Bebida',options:['Agua','Pepsi']}]);
  const drink=product(99303,'Gaseosa 400ml',4000,'Bebida individual',[{attributeName:'Sabor',options:['Agua','Pepsi']}]);
  for(const pick of [1,2,0,3,4,5,6,7]) it(`ambiguous presentation ${m.key}/${agent}/${pick}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      const reply=await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.cart.every(line=>line.productId===dish.id)).toBe(true);
      expect(reply).toContain('400ml');expect(reply).toContain('1.5L');
      expect(h.conv.sessionData.pendingMatch?.candidates.map(item=>item.id).sort()).toEqual([combo.id,large.id]);
      expect(h.conv.sessionData.pendingMatch?.quantity).toBe(2);
      expect(reply).toMatch(/elige|cu[aá]l|n[uú]mero|prefieres/i);
      const before=structuredClone(h.conv.sessionData.cart);
      expect(before).toHaveLength(1);
      expect(before[0]).toMatchObject({productId:dish.id,quantity:2});
      expect(before[0].note).toMatch(/sin cebolla/i);
      if(pick===3){
        const clarification=await h.sendQueued('sí');
        expect(clarification).toMatch(/cu[aá]l|elige|n[uú]mero/i);
        expect(h.conv.sessionData.cart).toEqual(before);
      }
      if(pick===4||pick===7) h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,price:34000},drink]);
      if(pick===5) h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,availableNow:false},drink]);
      if(pick===6) h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,attributes:[prep,{attributeName:'Bebida',options:['Agua','Uva']}]},drink]);
      const selection=await h.sendQueued(pick===0?'no gracias':String(pick>=3?2:pick));
      if(pick===4){expect(selection).toMatch(/34[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('sí');}
      if(pick===7){expect(selection).toMatch(/34[.,]000/);expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('1');}
      if(pick===5){expect(selection).toMatch(/no est[aá] disponible/i);expect(h.conv.sessionData.cart).toEqual(before);await h.sendQueued('1');}
      if(pick===6){expect(h.conv.sessionData.cart).toEqual(before);expect(h.conv.sessionData.pendingAttribute?.productId).toBe(large.id);await h.sendQueued('Uva');}
      const selectedId=pick===0?dish.id:pick===1||pick===5||pick===7?combo.id:large.id;
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:selectedId,quantity:2,note:before[0].note});
      if(pick!==0) expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:pick===6?'Uva':'Pepsi'});
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:993,dailyOrderNumber:93});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(selectedId);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Preparación',attributeValue:m.style});}
    } finally {
      writeFileSync(`/tmp/ppp-212-${m.key}-${agent}-${pick}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch},null,2));
    }
  });

}
