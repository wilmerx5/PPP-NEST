import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';

describe('Named destinations must match before pricing coverage', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  const result = (name: string, partial = false) => ({
    formatted_address: `${name}, Kennedy, Bogotá, Colombia`, partial_match: partial,
    geometry: { location: { lat: 4.62, lng: -74.15 } },
    address_components: [{long_name:name}, {short_name:'CO',types:['country']}],
  });
  function setup(results: unknown[]) {
    const service = new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
    global.fetch = jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results})});
    const route = jest.spyOn(service as any, 'directionsDistance').mockResolvedValue({distanceKm:0.5,durationMinutes:3});
    return {service,route};
  }
  const params = {customerAddress:'plazuelas de san esteban',restaurant:{lat:4.62,lng:-74.15},
    tiers:[{maxKm:5.5,fee:2000}],maxKm:5.5,fallbackFee:2000};
  it('does not price or reject coverage from a different nearby landmark', async () => {
    const {service,route}=setup([result('San Cristóbal')]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({ok:false,reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('selects the matching landmark after an unrelated first result', async () => {
    const {service,route}=setup([result('San Cristóbal'),result('Plazuela de San Esteban')]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({ok:true,distanceKm:0.5}));
    expect(route).toHaveBeenCalledTimes(1);
  });
  it('does not treat a partial place match as a verified address', async () => {
    const {service,route}=setup([result('San Esteban',true)]);
    expect(await service.quoteDeliveryFee(params)).toEqual(expect.objectContaining({reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('applies the same rule to another business and destination', async () => {
    const {service,route}=setup([result('Hotel Las Palmas')]);
    expect(await service.quoteDeliveryFee({...params,customerAddress:'hotel los robles'}))
      .toEqual(expect.objectContaining({reason:'address_ambiguous'}));
    expect(route).not.toHaveBeenCalled();
  });
  it('keeps explicit coordinates independent of the landmark spelling', async () => {
    const {service,route}=setup([]);
    expect(await service.quoteDeliveryFee({...params,customerCoords:{lat:4.62,lng:-74.15}}))
      .toEqual(expect.objectContaining({ok:true}));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledTimes(1);
  });
});

describe('A full numbered street is not rejected just because its reference is absent from Maps',()=>{
 const service=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never) as any;
 const result=(address:string,partial=false)=>({formatted_address:address,partial_match:partial,address_components:[]});
 it.each(['Calle 10 #81A-20, Conjunto Santa Catalina Club House','Conjunto Santa Catalina Club House, Calle 10 #81A-20'])('matches the street in %s',query=>{
  expect(service.resultMatchesNamedPlace(query,result('Cl. 10 #81a-20, Bogotá, Colombia'))).toBe(true);
 });
 it.each(['Cl. 10 #81a-21, Bogotá','Cra. 10 #81a-20, Bogotá','Cl. 11 #81a-20, Bogotá'])('rejects a different street or door: %s',address=>expect(service.resultMatchesNamedPlace('Calle 10 #81A-20, Conjunto Santa Catalina Club House',result(address))).toBe(false));
 it('rejects a partial street result',()=>expect(service.resultMatchesNamedPlace('Calle 10 #81A-20, Conjunto Santa Catalina Club House',result('Cl. 10 #81a-20, Bogotá',true))).toBe(false));
});

describe('Map lookup separates internal delivery units from the destination',()=>{
 const original=global.fetch;afterEach(()=>global.fetch=original);
 for(const place of ['Villa Galante','Conjunto Los Pinos','Edificio Las Acacias'])it(`${place}: entrance and apartment do not become map address numbers`,async()=>{
  const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);const requests:string[]=[];
  global.fetch=jest.fn().mockImplementation(async (url:string)=>{requests.push(new URL(url).searchParams.get('address')||'');return {status:200,json:async()=>({status:'OK',results:[{formatted_address:`${place}, Kennedy, Bogotá, Colombia`,partial_match:false,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})};});
  const route=jest.spyOn(service as any,'directionsDistance').mockResolvedValue({distanceKm:1.5,durationMinutes:4});
  const quote=await service.quoteDeliveryFee({customerAddress:`A ${place} entrada 43 apartamento 48`,restaurant:{lat:4.62,lng:-74.15},tiers:[{maxKm:8.5,fee:2000}],maxKm:8.5,fallbackFee:2000});
  expect(quote).toMatchObject({ok:true,distanceKm:1.5,fee:2000});expect(route).toHaveBeenCalledTimes(1);expect(requests[0]).toMatch(new RegExp(place));expect(requests.every(query=>!/entrada|apartamento|\b43\b|\b48\b/i.test(query))).toBe(true);
 });
 it('does not accept a different Villa just because it is nearby',async()=>{
  const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{formatted_address:'Villa Lejana, Bogotá',partial_match:false,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})});const route=jest.spyOn(service as any,'directionsDistance');
  expect(await service.quoteDeliveryFee({customerAddress:'Villa Galante entrada 43 apartamento 48',restaurant:{lat:4.62,lng:-74.15},tiers:[{maxKm:8.5,fee:2000}],maxKm:8.5,fallbackFee:2000})).toMatchObject({ok:false,reason:'address_ambiguous'});expect(route).not.toHaveBeenCalled();
 });
});

describe('Lettered access does not make an uncertain map result valid',()=>{
 const original=global.fetch;afterEach(()=>global.fetch=original);
 for(const details of ['torre B apartamento 304B','bloque C casa 12A','interior 2A oficina 405'])for(const partial of [false,true])it(`${details} partial=${partial}`,async()=>{
  const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);
  const queries:string[]=[];
  global.fetch=jest.fn().mockImplementation(async(url:string)=>{queries.push(new URL(url).searchParams.get('address')||'');return {status:200,json:async()=>({status:'OK',results:[{formatted_address:partial?'Conjunto Los Olivos, Bogotá':'Conjunto Los Pinos, Bogotá',partial_match:partial,geometry:{location:{lat:4.62,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]})};});
  const route=jest.spyOn(service as any,'directionsDistance');
  const result=await service.quoteDeliveryFee({customerAddress:`Conjunto Los Olivos ${details}`,restaurant:{lat:4.62,lng:-74.15},tiers:[{maxKm:8.5,fee:2000}],maxKm:8.5,fallbackFee:2000});
  expect(result).toMatchObject({ok:false,reason:'address_ambiguous'});expect(route).not.toHaveBeenCalled();
  expect(queries.length).toBeGreaterThan(0);expect(queries.every(query=>!/torre|bloque|interior|apartamento|oficina|casa/i.test(query))).toBe(true);
 });
});
