import { WhatsappDeliveryRoutingService } from './whatsapp-delivery-routing.service';
import { canonicalStreetAddress } from './whatsapp-address-parts';
const inputs = ['calle 6 a # 79a 61','Cll. 6A Nº 79A–61','CL 6A #79A_61','calle 6a 79a 61 torre 2 apto 301','Carrera 81 H #51 A–39 Sur','Tv 78C #6D–48'];
const expected = ['Calle 6A # 79A-61','Calle 6A # 79A-61','Calle 6A # 79A-61','Calle 6A # 79A-61','Carrera 81H # 51A-39 Sur','Transversal 78C # 6D-48'];
const original=global.fetch;
afterEach(()=>global.fetch=original);
for(let i=0;i<inputs.length;i++) {
 it(`canonical preserves street identity: ${inputs[i]}`,()=>expect(canonicalStreetAddress(inputs[i])).toBe(expected[i]));
 it(`recovers punctuation-free lookup: ${inputs[i]}`,async()=>{
  const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);
  const queries:string[]=[];
  const clean=expected[i].replace(/[#-]/g,' ').replace(/\s+/g,' ').trim();
  global.fetch=jest.fn().mockImplementation(async(url:string)=>{
   const q=new URL(url).searchParams.get('address')||'';queries.push(q);
   return {status:200,json:async()=>q.startsWith(clean+',')?{status:'OK',results:[{formatted_address:expected[i]+', Bogotá, Colombia',geometry:{location:{lat:4.63,lng:-74.15}},address_components:[{short_name:'CO',types:['country']}]}]}:{status:'ZERO_RESULTS',results:[]}};
  });
  const route=jest.spyOn(service as any,'directionsDistance').mockResolvedValue({distanceKm:0.5,durationMinutes:3});
  const quote=await service.quoteDeliveryFee({customerAddress:inputs[i],restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:8.5,fee:2000}],maxKm:8.5,fallbackFee:2000});
  expect(quote).toMatchObject({ok:true,fee:2000});expect(route).toHaveBeenCalledTimes(1);
  expect(queries.some(q=>q.startsWith(clean+','))).toBe(true);
  expect(queries.every(q=>!/torre|apto|301/i.test(q))).toBe(true);
  expect(queries.length).toBeLessThanOrEqual(10);
 });
}
for(const road of ['Calle 6A','Carrera 81H','Transversal 78C'])for(const kind of ['exact','wrong_door','wrong_road','partial'])it(`structured result ${road}/${kind}`,()=>{
 const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never) as any;
 const result={formatted_address:'Dirección con formato del proveedor',partial_match:kind==='partial',address_components:[
  {long_name:kind==='wrong_road'?'Calle 99':road,types:['route']},
  {long_name:kind==='wrong_door'?'79A-62':'79A-61',types:['street_number']},
 ]};
 expect(service.resultMatchesNamedPlace(`${road} #79A-61`,result)).toBe(kind==='exact');
});

it('explains real provider street differences instead of silently accepting BIS or B',async()=>{
 const service=new WhatsappDeliveryRoutingService({get:()=> 'mock-key'} as never);
 global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:['Cl. 6a #79A BIS-61, Bogotá, Colombia','Cl. 6a #79B-61, Bogotá, Colombia'].map(formatted_address=>({formatted_address,partial_match:false,geometry:{location:{lat:4.6342,lng:-74.1498}},address_components:[{short_name:'CO',types:['country']}]}))})});
 const route=jest.spyOn(service as any,'directionsDistance');
 const result=await service.quoteDeliveryFee({customerAddress:'calle 6 a #79a 61',restaurant:{lat:4.63,lng:-74.15},tiers:[{maxKm:8.5,fee:2000}],maxKm:8.5,fallbackFee:2000});
 expect(result).toMatchObject({ok:false,reason:'address_ambiguous'});
 if(!result.ok) {expect(result.message).toMatch(/79A Bis-61/);expect(result.message).toMatch(/79B-61/);expect(result.message).toMatch(/ubicaci[oó]n/);}
 expect(route).not.toHaveBeenCalled();
});
