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
  const cases=[
    {key:'unknown_code',question:'¿Cuánto cuesta el código 99303?',expected:/cu[aá]l opci[oó]n/i,pick:'2'},
    {key:'removed_code',question:'¿Qué sabores tiene el código 99304?',expected:/no est[aá] disponible/i,pick:'1'},
    {key:'missing_description',question:'¿Qué incluye el #99304?',expected:/No tengo el detalle/i,pick:'#99304'},
    {key:'short_code',question:'¿Qué trae el #99304?',expected:/ensalada.*1.5L/i,pick:'#99304'},
    {key:'price_code',question:'¿Cuánto cuesta el código 99304?',expected:/30[.,]000/,pick:'#99304'},
    {key:'flavor_code',question:'¿Qué sabores tiene el código 99304?',expected:/Uva/,pick:'2'},
    {key:'content_code',question:'¿Con qué viene el código 99304?',expected:/ensalada.*1.5L/i,pick:'#99304'},
    {key:'content_volume',question:'¿Con qué viene el de 1.5L?',expected:/ensalada.*1.5L/i,pick:'el de 1.5L'},
    {key:'flavor_volume',question:'¿Qué sabores tiene el de 1.5L?',expected:/Uva/,pick:'2'},
    {key:'other_presentation',question:'¿Qué sabores tiene el de 400ml?',expected:/Pepsi/,pick:'1'},
  ];
  for(const c of cases) it(`offered candidate inquiry ${m.key}/${agent}/${c.key}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const before=structuredClone(h.conv.sessionData.cart);
      const changed={...large,description:c.key==='missing_description'?'':large.description,availableNow:c.key!=='removed_code',attributes:[prep,{attributeName:'Bebida',options:['Agua','Uva']}]};
      h.service.catalogService.getMenuProducts.mockResolvedValue([dish,combo,changed,drink]);
      const answer=await h.sendQueued(c.question);
      expect(answer).toMatch(c.expected);
      if(c.key==='flavor_code'||c.key==='flavor_volume') expect(answer).not.toMatch(/Pepsi/);
      expect(h.conv.sessionData.cart).toEqual(before);
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      expect(answer).toMatch(/elige|elegir|n[uú]mero|prefieres|otra opci[oó]n/i);
      const selection=await h.sendQueued(c.pick);
      const small=['other_presentation','removed_code'].includes(c.key);
      if(!small){
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingAttribute?.productId).toBe(large.id);
        expect(selection).toMatch(/Uva/);
        await h.sendQueued('Uva');
      }
      const id=small?combo.id:large.id, flavor=small?'Pepsi':'Uva';
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:id,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:flavor});
      Object.assign(h.conv.sessionData,{orderType:'pickup',fulfillmentChosen:true,phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true,address:'Recoge en el local',addressConfirmed:true});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:995,dailyOrderNumber:95});
      h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const items=h.service.ordersService.create.mock.calls[0][0].items;
      expect(items).toHaveLength(2);
      for(const item of items){expect(item.productId).toBe(id);expect(item.note).toMatch(/sin cebolla/i);expect(item.attributes).toContainEqual({attributeName:'Bebida',attributeValue:flavor});}
    } finally {
      writeFileSync(`/tmp/ppp-215-${m.key}-${agent}-${c.key}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,session:h.conv.sessionData},null,2));
    }
  });
}
