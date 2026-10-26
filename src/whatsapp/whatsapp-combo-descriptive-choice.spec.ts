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
  const combo=product(99302,`Combo ${m.title}`,26000,'Presentación pequeña. Incluye ensalada y bebida de 400ml',[prep,{attributeName:'Bebida',options:['Agua','Pepsi']}]);
  const drink=product(99303,'Gaseosa 400ml',4000,'Bebida individual',[{attributeName:'Sabor',options:['Agua','Pepsi']}]);
  const cases=[
    {key:'unlabeled',text:'el grande',id:99304},
    {key:'ambiguous',text:'el grande',id:99304},
    {key:'unavailable',text:'el grande',id:99302},
    {key:'mixed_unknown',text:'¿Con qué viene el de 1.5L? Dame el familiar',id:99304},
    {key:'mixed_price',text:'¿Cuánto cuesta el código 99304? Dame el grande',id:99304},
    {key:'large',text:'el grande',id:99304},
    {key:'small',text:'quiero el pequeño',id:99302},
    {key:'family',text:'dame el familiar',id:99304},
    {key:'mixed_large',text:'¿Con qué viene el de 1.5L? Dame el grande',id:99304},
    {key:'mixed_small',text:'¿Cuánto cuesta el código 99302? Quiero el pequeño',id:99302},
  ];
  for(const c of cases) it(`descriptive choice ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:`Presentación ${c.key==='family'?'familiar':'grande'}. Incluye ensalada y bebida de 1.5L`};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart);
      if(c.key==='unlabeled') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,description:'Incluye ensalada grande y bebida de 1.5L'},drink]);
      if(c.key==='ambiguous') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,{...combo,description:'Presentación grande. Incluye ensalada y bebida de 400ml'},large,drink]);
      if(c.key==='unavailable') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,availableNow:false},drink]);
      if(c.key==='mixed_price') h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,{...large,price:34000},drink]);

      const replyStart=h.replies.length;
      await h.sendQueued(c.text);
      const answer=h.replies.slice(replyStart).join('\n');
      if(c.key==='mixed_large') expect(answer).toMatch(/ensalada.*1.5L/i);
      if(c.key==='mixed_small') expect(answer).toMatch(/26[.,]000/);
      if(['unlabeled','ambiguous','unavailable','mixed_unknown','mixed_price'].includes(c.key)){
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
        if(c.key==='unavailable') expect(answer).toMatch(/no est[aá] disponible/i);
        else if(c.key==='mixed_price') expect(answer).toMatch(/34[.,]000/);
        else expect(answer).toMatch(/elige|lista|presentaci[oó]n/i);
        if(c.key==='mixed_unknown') expect(answer).toMatch(/ensalada.*1.5L/i);
        await h.sendQueued(c.key==='unavailable'?'1':c.key==='mixed_price'?'sí':'2');
      }
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:c.id,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
      expect(h.conv.sessionData.pendingMatch).toBeFalsy();
      if(!['unlabeled','ambiguous','unavailable','mixed_unknown','mixed_price'].includes(c.key)) expect(answer).toMatch(/Listo|agreg|cambi/i);
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:996,dailyOrderNumber:96});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(c.id);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});}
    } finally {writeFileSync(`/tmp/ppp-216-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,session:h.conv.sessionData,state:h.conv.state},null,2));}
  });
}
