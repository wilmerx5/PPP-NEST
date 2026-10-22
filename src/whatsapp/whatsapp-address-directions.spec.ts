import { splitDeliveryAddressParts, splitAddressReference } from './whatsapp-address-parts';
import { WhatsappOrchestratorService } from './whatsapp-orchestrator.service';
import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

const road = 'carrera 81 h 51 a 39 sur';
const hints = ['al frente del parque', 'en la esquina', 'junto a la droguería', 'esquina, portón azul',
  'alfrente del parque', 'a un costado del colegio', 'queda al frente de la iglesia',
  'por la entrada de visitantes', 'portería principal', 'es la casa esquinera'];

describe('external destination and driver directions', () => {
  it.each(hints)('separates %s after a numbered street', hint => {
    expect(splitDeliveryAddressParts(`${road}, ${hint}`)).toEqual({base:road, details:hint});
  });
  it.each(hints)('keeps unit and reference together: %s', hint => {
    expect(splitDeliveryAddressParts(`Conjunto Los Pinos torre 3 apto 402, ${hint}`))
      .toEqual({base:'Conjunto Los Pinos', details:`torre 3 apto 402, ${hint}`});
  });
  it.each(['al frente del parque','en la esquina','junto a la droguería'])('recognizes a leading delimited reference: %s', hint => {
    expect(splitAddressReference(`${hint}; ${road}`)).toEqual({address:road,reference:hint});
  });
  it.each(['frente al parque','en la esquina','Edificio La Esquina','Conjunto Frente al Parque',
    'calle 10 en la esquina con carrera 20','calle 10 frente a carrera 20',
    'calle 10 # 20-30 frente a calle 12 # 22-40'])('does not discard ambiguous destinations: %s', text => {
    expect(splitAddressReference(text)).toEqual({address:text,reference:''});
  });
});

const menus=['Bowl Andino','Hamburguesa Doble','Pizza Hawaiana'];
describe.each(menus)('%s: address correction through checkout', dish => {
  describe.each([false,true])('agent %s', agent => {
    const previousFetch=global.fetch;
    afterEach(()=>{global.fetch=previousFetch;});
    const start=async (wrongDoor=false) => {
      const h=harness([{id:811,code:811,name:dish,price:20000,availableNow:true,hasAttributes:false,attributes:[]}] as never,agent);
      // Exercise the actual output guard and customer address formatting; transport stays mocked.
      h.service.reply=(WhatsappOrchestratorService.prototype as any).reply.bind(h.service);
      h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
      h.agent.runTurn.mockResolvedValue({reply:'¿Algo más?',actions:{},toolCalls:[]});
      h.service.ordersService.create=jest.fn().mockResolvedValue({id:108,dailyOrderNumber:108});
      Object.assign(h.cfg,{deliveryFeeMode:'distance',deliveryFeeTiers:[{maxKm:5.5,fee:5000}],deliveryMaxKm:5.5,restaurantLat:4.63,restaurantLng:-74.15});
      const routing=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);
      const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:4.3,durationMinutes:12});
      const queries:string[]=[];
      global.fetch=jest.fn().mockImplementation(async (url:string)=>{
        const q=new URL(url).searchParams.get('address')||'';queries.push(q);
        return {status:200,json:async()=>({status:'OK',results:[{formatted_address:`Cra. 81h #51a-${wrongDoor?'65':'39'} Sur, Bogotá, Colombia`,
          partial_match: !/#/.test(q),geometry:{location:{lat:4.635,lng:-74.16}},address_components:[{short_name:'CO',types:['country']}]}]})};
      });
      (h.service as any).deliveryRouting=routing;
      await h.sendQueued(`dame un ${dish}`);
      h.conv.sessionData.lastDeliveryAddress='Calle 10 # 20-30';
      h.conv.sessionData.orderType='delivery';
      await h.sendQueued('nada mas');await h.sendQueued('a una nueva');
      return {h,queries,route};
    };
    it.each(['al frente del parque','en la esquina','alfrente del parque','esquina, portón azul'])('keeps %s through the final DTO',async hint=>{
      const {h,queries}=await start();
      const address=`${road}, ${hint}`;
      const reply=await h.sendQueued(address);
      expect(reply).not.toMatch(/no pude identificar/i);
      expect(h.conv.sessionData.address).toBe(address);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
      expect(queries.every(q=>!q.includes(hint))).toBe(true);
      await h.sendQueued('a nombre de Carlos Torres');await h.sendQueued('3000000006');await h.sendQueued('contraentrega');
      expect(h.conv.state).toBe('awaiting_final_confirm');
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
      const dto=h.service.ordersService.create.mock.calls[0][0];
      expect(dto.address).toContain(road);expect(dto.address).toContain(`Ref: ${hint}`);
      expect(dto.address).not.toContain('Calle 10 # 20-30');
      expect(dto.items.map((i:any)=>i.productId)).toEqual([811]);
    });
    it('a leading reference reaches the map as a street, not as the park',async()=>{
      const {h,queries}=await start();
      await h.sendQueued(`al frente del parque; ${road}`);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.every(q=>!q.includes('parque'))).toBe(true);
      expect(h.conv.sessionData.address).toContain(road);
    });
    it('changing a previously quoted address discards its old coordinates and fee',async()=>{
      const {h,queries}=await start();
      Object.assign(h.conv.sessionData,{address:'Calle 10 # 20-30',addressConfirmed:true,
        deliveryLat:4.64,deliveryLng:-74.17,deliveryFeeCalculated:2000,deliveryDistanceKm:0.5});
      h.conv.state='awaiting_payment';
      const reply=await h.sendQueued(`cambia la direccion a ${road}, junto a la droguería`);
      expect(h.conv.sessionData.address).toContain(road);
      expect(h.conv.sessionData.address).not.toContain('Calle 10');
      expect(queries.length).toBeGreaterThan(0);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBe(5000);
      expect(h.conv.sessionData.deliveryLat).not.toBe(4.64);
      expect(reply).not.toMatch(/Calle 10/);
    });
    it.each([0,5000])('does not block a genuinely quoted destination with fee %s',async fee=>{
      const {h}=await start();
      await h.sendQueued(`${road}, al frente del parque`);
      h.conv.sessionData.deliveryFeeCalculated=fee;
      await h.service.reply(h.conv,'customer','Tu dirección ya está confirmada.');
      expect(h.replies.at(-1)).toContain('ya está confirmada');
    });
    it('a complaint cannot turn a failed map lookup into a confirmed address',async()=>{
      const {h}=await start(true);
      await h.sendQueued(`${road}, al frente del parque`);
      h.agent.runTurn.mockResolvedValue({reply:'Tu dirección ya está confirmada. No necesitas enviarla otra vez.',actions:{},toolCalls:[]});
      h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'Tu dirección ya está confirmada. No necesitas enviarla otra vez.',actions:{}});
      const reply=await h.sendQueued('como que no la identificas si esa es mi direccion');
      expect(reply).not.toMatch(/ya est[aá] confirmada|no necesitas enviarla/i);
      expect(h.conv.sessionData.deliveryFeeCalculated).toBeNull();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.address).toContain(road);
      await h.sendQueued('confirmar');
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
    });
    it('rejects a different door even with a familiar reference',async()=>{
      const {h,route}=await start(true);
      const reply=await h.sendQueued(`${road}, al frente del parque`);
      expect(reply).toMatch(/no pude identificar/i);
      expect(route).not.toHaveBeenCalled();
      expect(h.service.ordersService.create).not.toHaveBeenCalled();
      expect(h.conv.sessionData.address).toContain(road);
      expect(reply).not.toMatch(/o la direcci[oó]n con calle y n[uú]mero/i);
    });
  });
});
