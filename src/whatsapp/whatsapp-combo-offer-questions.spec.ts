/** Queries preserve the offered candidate, then close through the full mocked router. */
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
    {key:'price',text:'¿Cuánto cuesta el combo?',answer:/26[.,]000/},
    {key:'new_price',text:'cuanto cuesta el combo',answer:/30[.,]000/},
    {key:'new_flavors',text:'que bebidas tiene el combo',answer:/Uva/i},
    {key:'price',text:'cuanto vale el combo por favor',answer:/26[.,]000/},
    {key:'price',text:'me dices el precio del combo',answer:/26[.,]000/},
    {key:'flavors',text:'¿Qué sabores de bebida tiene el combo?',answer:/Pepsi/i},
    {key:'flavors',text:'que bebidas tiene el combo porfa',answer:/Pepsi/i},
    {key:'flavors',text:'cuales sabores hay para el combo',answer:/Pepsi/i},
  ];
  for(const c of cases) it(`offer interruption ${m.key}/${agent}/${c.text}`,async()=>{
    const h=harness([dish,combo,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine.productId).toBe(dish.id);
      const before=structuredClone(h.conv.sessionData.cart);
      expect(before).toHaveLength(1);expect(before[0].quantity).toBe(2);
      if(c.key==='new_price') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,{...combo,price:30000},drink]);
      if(c.key==='new_flavors') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,{...combo,attributes:[prep,{attributeName:'Bebida',options:['Agua','Uva']}]},drink]);
      const reply=await h.sendQueued(c.text);
      if(c.key==='new_flavors') expect(reply).not.toMatch(/Pepsi/);
      expect(reply).toMatch(c.answer);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.replacement?.originalLine).toEqual(before[0]);
      expect(reply).toMatch(/sí|si|elige|prefieres/i);
      await h.sendQueued('sí, el combo');
      if(c.key==='new_price') {
        expect(h.conv.sessionData.cart).toEqual(before);
        await h.sendQueued('sí');
      }
      if(c.key==='new_flavors') {
        expect(h.conv.sessionData.cart).toEqual(before);
        await h.sendQueued('Uva');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:combo.id,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:c.key==='new_flavors'?'Uva':'Pepsi'});
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:993,dailyOrderNumber:93});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(2);
      const meals=items.filter((item:any)=>item.productId===combo.id);
      expect(meals).toHaveLength(2);
      for(const item of meals){expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Preparación',attributeValue:m.style});}
    } finally {
      writeFileSync(`/tmp/ppp-211-${m.key}-${agent}-${cases.indexOf(c)}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,pendingMatch:h.conv.sessionData.pendingMatch,pendingAttribute:h.conv.sessionData.pendingAttribute},null,2));
    }
  });
  it(`withdrawn combo question ${m.key}/${agent}`, async()=>{
    const h=harness([dish,combo,drink],agent);h.cfg.ignoreBusinessHours=false;
    await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
    const before=structuredClone(h.conv.sessionData.cart);
    h.service.catalogService.getMenuProducts.mockResolvedValue([dish,{...combo,availableNow:false},drink]);
    const reply=await h.sendQueued('cuanto cuesta el combo');
    expect(reply).toMatch(/ya no est[aá] disponible/i);
    expect(reply).not.toMatch(/Responde.*s[ií]/i);
    expect(h.conv.sessionData.cart).toEqual(before);
    const accept=await h.sendQueued('sí, el combo');
    expect(accept).toMatch(/no est[aá] disponible/i);
    expect(h.conv.sessionData.cart).toEqual(before);
  });
}
