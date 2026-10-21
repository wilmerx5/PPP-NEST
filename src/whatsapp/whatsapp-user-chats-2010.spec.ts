import { harness } from './whatsapp-accuracy.test-support';

const menu=[
  {id:1,code:1,name:'1 Pollo Frito',price:41000,availableNow:true,attributes:[]},
  {id:94,code:94,name:'Combo De Arroz Paisa',price:47000,availableNow:true,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Colombiana','Coca Cola']}]},
];
for(const enabled of [false,true]) {
  it(`text form with truncated greeting keeps the combo, agent=${enabled}`,async()=>{
    const h=harness(menu,enabled);
    h.service.ordersService.create=jest.fn().mockResolvedValue({id:88,dailyOrderNumber:88});
    await h.sendQueued('enas tardes Me das este combo de arroz paisa\nAna Torres\nConjunto Los Robles\nDiagonal 3 #83-02\nTorre 3 apto 102\n3001234567');
    expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([94]);
    expect(h.conv.sessionData.address).toMatch(/83-02/);
    expect(h.conv.sessionData.contactPhone).toMatch(/3001234567/);
    expect(h.conv.customerName).toBe('Ana Torres');
    await h.sendQueued('1');
    expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([94]);
    await h.sendQueued('contraentrega');
    expect(h.service.ordersService.create).not.toHaveBeenCalled();
    await h.sendQueued('confirmar');
    expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
    const dto=h.service.ordersService.create.mock.calls[0][0];
    expect(dto.items.map((i:any)=>i.productId)).toEqual([94]);
    expect(dto.customerName).toBe('Ana Torres');expect(dto.phone).toMatch(/3001234567/);
    expect(dto.address).toMatch(/83-02/);expect(dto.address).toMatch(/102/);
  });
  it(`correction rejects the erroneous chicken and names the combo, agent=${enabled}`,async()=>{
    const h=harness(menu,enabled);
    h.conv.sessionData.cart=[{productId:1,code:1,name:'1 Pollo Frito',quantity:1,unitPrice:41000,attributes:[]}];
    await h.sendQueued('no quieria un pollo, queria el combo de arroz paisa');
    expect(h.conv.sessionData.cart.map(l=>l.productId)).toEqual([94]);
  });
  it(`explicit rejection must not claim to keep chicken, agent=${enabled}`,async()=>{
    const h=harness(menu,enabled);
    h.conv.sessionData.cart=[{productId:1,code:1,name:'1 Pollo Frito',quantity:1,unitPrice:41000,attributes:[]}];
    const reply=await h.sendQueued('no quiero un pollo');
    expect(reply).not.toMatch(/conservo 1 pollo/i);
    expect(h.conv.sessionData.cart).toHaveLength(0);
  });
}
