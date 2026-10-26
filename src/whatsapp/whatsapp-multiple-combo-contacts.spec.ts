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
  for(const mode of ['separate','together','correct']) it(`multiple offer contacts ${m.key}/${agent}/${mode}`,async()=>{
    const large={...combo,id:99304,code:99304,price:30000,description:'Incluye ensalada y bebida de 1.5L'};
    const h=harness([dish,combo,large,drink],agent);h.cfg.ignoreBusinessHours=false;
    h.conv.customerName='';
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:994,dailyOrderNumber:94});
    h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
    try {
      await h.sendQueued(`Quiero dos ${m.title} ${m.style} con bebida Pepsi, sin cebolla`);
      const before=structuredClone(h.conv.sessionData.cart);
      expect(before).toHaveLength(1);expect(before[0]).toMatchObject({productId:dish.id,quantity:2});
      expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
      const details=['a nombre de Ana Torres','3001112233','Calle 10 #20-30 torre 4 apto 502'];
      for(const text of mode==='separate'?details:[details.join('\n')]){
        const reply=await h.sendQueued(text);
        expect(h.conv.sessionData.cart).toEqual(before);
        expect(h.conv.sessionData.pendingMatch?.candidates).toHaveLength(2);
        expect(reply).toMatch(/elige|cu[aá]l|n[uú]mero|presentaci[oó]n|opci[oó]n/i);
        expect(h.service.ordersService.create).not.toHaveBeenCalled();
      }
      if(mode==='correct') await h.sendQueued('a nombre de Luis Perez\n3012223344\nCarrera 12 #34-56 torre 2 apto 201');
      await h.sendQueued('2');
      expect(h.conv.sessionData.cart).toHaveLength(1);
      expect(h.conv.sessionData.cart[0]).toMatchObject({productId:large.id,quantity:2,note:before[0].note});
      expect(h.conv.sessionData.cart[0].attributes).toContainEqual({attributeName:'Bebida',attributeValue:'Pepsi'});
      expect(h.conv.customerName).toBe(mode==='correct'?'Luis Perez':'Ana Torres');
      await h.sendQueued('nada más');await h.sendQueued('contraentrega');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(2);
      for(const item of dto.items){expect(item.productId).toBe(large.id);expect(item.note).toMatch(/sin cebolla/i);}
      expect(dto.customerName).toBe(mode==='correct'?'Luis Perez':'Ana Torres');
      expect(dto.phone.replace(/\D/g,'')).toContain(mode==='correct'?'3012223344':'3001112233');
      expect(dto.address).toMatch(mode==='correct'?/34-56.*201/:/20-30.*502/);
    } finally {
      writeFileSync(`/tmp/ppp-214-contacts-${m.key}-${agent}-${mode}.json`,JSON.stringify({replies:h.replies,cart:h.conv.sessionData.cart,state:h.conv.state,session:h.conv.sessionData,name:h.conv.customerName},null,2));
    }
  });
}
