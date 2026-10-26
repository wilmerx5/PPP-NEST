/** Questions and contact updates must preserve a quoted purchase until acceptance. */
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
  const combo=product(99302,`Combo ${m.title}`,26000,'Presentación pequeña. Incluye ensalada y bebida de 400ml',[prep,{attributeName:'Bebida',options:['Agua','Pepsi']}]);
  const drink=product(99303,'Gaseosa 400ml',4000,'Bebida individual',[{attributeName:'Sabor',options:['Agua','Pepsi']}]);
  const cases=[
    {key:'sequence',text:'a nombre de Ana Torres',reply:/Ana Torres/i},
    {key:'price',text:'¿Cuánto cuesta el grande?',reply:/34[.,]000/},
    {key:'content',text:'¿Qué trae el grande?',reply:/ensalada.*1.5L/i},
    {key:'phone',text:'mi celular es 300 111 2233',reply:/300/},
    {key:'name',text:'a nombre de Ana Torres',reply:/Ana Torres/i},
  ];
  for(const c of cases) it(`quote interruption ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Presentación grande. Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart);
      h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,price:34000},drink]);
      await h.sendQueued('el grande con Agua');
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
      const start=h.replies.length;await h.sendQueued(c.text);
      expect(h.replies.slice(start).join('\n')).toMatch(c.reply);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
      if(c.key==='sequence') {
        for(const turn of [
          {text:'mi celular es 300 111 2233',reply:/300/},
          {text:'¿Qué trae el grande?',reply:/ensalada.*1.5L/i},
          {text:'¿Cuánto cuesta el grande?',reply:/34[.,]000/},
        ]) {
          const from=h.replies.length;await h.sendQueued(turn.text);
          expect(h.replies.slice(from).join('\n')).toMatch(turn.reply);
          expect(h.conv.sessionData.cart).toEqual(before);
          expect(h.conv.sessionData.pendingMatch?.priceAcceptanceProductId).toBe(99304);
        }
      }
      expect(h.conv.sessionData.pendingMatch?.offeredChoices?.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});
      if((c.key==='phone'||c.key==='sequence')) expect(h.conv.sessionData.contactPhone?.replace(/\D/g,'')).toContain('3001112233');
      if((c.key==='name'||c.key==='sequence')) expect(h.conv.customerName).toBe('Ana Torres');
      const accepted=await h.sendQueued('sí');
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:99304,quantity:2,note:before[0].note,unitPrice:34000});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      const suppliedContact=['phone','name','sequence'].includes(c.key);
      expect(h.conv.state).toBe(suppliedContact?'awaiting_payment':'building_cart');
      expect(accepted).toMatch(suppliedContact?/c[oó]mo pagas/i:/algo m[aá]s/i);
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.sessionData.contactPhone || h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      expect(h.conv.state).toBe('completed');
      const dto=h.service.ordersService.create.mock.calls[0][0];
      if((c.key==='phone'||c.key==='sequence')) expect(dto.phone.replace(/\D/g,'')).toContain('3001112233');
      if((c.key==='name'||c.key==='sequence')) expect(dto.customerName).toBe('Ana Torres');
      const items=dto.items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(99304);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Agua'});}
    } finally {writeFileSync(`/tmp/ppp-221-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
