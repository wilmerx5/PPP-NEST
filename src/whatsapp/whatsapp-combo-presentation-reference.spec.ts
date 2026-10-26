/** References select only offered candidates; queries preserve the cart until a later choice. */
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
  const cases=[
    {key:'code',text:'#99304',id:99304},
    {key:'duplicate_volume',text:'el de 400ml',id:99304},
    {key:'changed_volume',text:'el de 1.5L',id:99304},
    {key:'removed_code',text:'#99304',id:99302},
    {key:'new_price_code',text:'#99304',id:99304},
    {key:'named_code',text:'el código 99302 por favor',id:99302},
    {key:'decimal',text:'el de 1,5 litros',id:99304},
    {key:'milliliters',text:'quiero el de 400ml',id:99302},
    {key:'words',text:'el de litro y medio',id:99304},
    {key:'unknown_code',text:'#99303',id:99304},
    {key:'unknown_volume',text:'el de 2 litros',id:99304},
    {key:'price_question',text:'¿Cuánto cuesta el de 1.5L?',id:99304},
    {key:'flavor_question',text:'¿Qué sabores tiene el de 400ml?',id:99304},
  ];
  for(const c of cases) it(`presentation reference ${m.key}/${agent}/${c.key}`,async()=>{
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
      if(c.key==='duplicate_volume') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,description:'Incluye ensalada y bebida de 400ml'},drink]);
      if(c.key==='changed_volume') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,description:'Incluye ensalada y bebida de 2L'},drink]);
      if(c.key==='removed_code') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,availableNow:false},drink]);
      if(c.key==='new_price_code') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,price:34000},drink]);
      const answer=await h.sendQueued(c.text);
      const interruption=c.key.startsWith('unknown')||c.key.endsWith('question')||['duplicate_volume','changed_volume','removed_code','new_price_code'].includes(c.key);
      if(interruption){
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
        if(c.key==='price_question') expect(answer).toMatch(/30[.,]000/);
        else if(c.key==='flavor_question') expect(answer).toMatch(/Pepsi/);
        else if(c.key==='removed_code') expect(answer).toMatch(/no est[aá] disponible/i);
        else if(c.key==='new_price_code') expect(answer).toMatch(/34[.,]000/);
        else expect(answer).toMatch(/elige|lista|opci[oó]n|presentaci[oó]n/i);
        await h.sendQueued(c.key==='removed_code'?'1':c.key==='new_price_code'?'sí':'2');
      }
      const selectedId=c.id;
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:selectedId,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
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
      writeFileSync(`/tmp/ppp-213-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch},null,2));
    }
  });

}
