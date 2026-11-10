import {canonicalStreetAddress} from './whatsapp-address-parts';
import {WhatsappDeliveryRoutingService} from './whatsapp-delivery-routing.service';
import {harness} from './whatsapp-accuracy.test-support';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.restoreAllMocks();});
const samples=[['Cll6b#80g17','Calle 6B # 80G-17'],['Cra80b#6a31','Carrera 80B # 6A-31']];
for(const [input,street] of samples) for(const agent of [false,true]) {
 test(`${input}/agent=${agent}: compact letter-door address reaches checkout unchanged`,async()=>{
  const h=harness([{id:94740,code:74,name:'Bowl Andino',price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  global.fetch=jest.fn().mockResolvedValue({status:200,json:async()=>({status:'OK',results:[{
   formatted_address:street+', Bogotá, Colombia',types:['street_address'],geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]
  }]})});
  h.service.deliveryRouting=routing;
  await h.sendQueued('quiero un Bowl Andino');await h.sendQueued('nada más');
  const reply=await h.sendQueued(input);
  expect(canonicalStreetAddress(input)).toBe(street);
  expect(reply).toMatch(/Cómo pagas|pago/i);
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(1);
  expect(canonicalStreetAddress(dto.address)).toBe(street);
 });
}

for(const agent of [false,true]) test(`reported corrected street retries Google-style abbreviation; agent=${agent}`,async()=>{
 const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
 const queries:string[]=[];
 global.fetch=jest.fn().mockImplementation(async(url:string)=>{
  const q=new URL(url).searchParams.get('address')||'';queries.push(q);
  const hit=q==='Cl. 10B #81F-20, Bogotá, Colombia';
  return {status:200,json:async()=>({status:'OK',results:[{formatted_address:hit?'Cl. 10b #81f-20, Bogotá, Colombia':'Calle 10 #86B-81, Bogotá, Colombia',types:['street_address'],geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]}]})};
 });
 jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
 const h=harness([{id:94741,code:75,name:'Bowl Vegetal',price:18000,availableNow:true,attributes:[]}],agent);
 Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
 Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
 h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
 h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
 h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
 h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
 h.service.deliveryRouting=routing;
 await h.sendQueued('quiero un Bowl Vegetal');await h.sendQueued('nada más');
 await h.sendQueued('Calle 10 #81f-20 apto 402');
 expect(h.service.ordersService.create).not.toHaveBeenCalled();
 const reply=await h.sendQueued('Cl. 10B #81f-20 apto 402');
 expect(queries).toContain('Cl. 10B #81F-20, Bogotá, Colombia');
 expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
 expect(reply).toMatch(/Cómo pagas|pago/i);
 await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
 expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
 const dto=h.service.ordersService.create.mock.calls[0][0];
 expect(canonicalStreetAddress(dto.address)).toBe('Calle 10B # 81F-20');
 expect(dto.address).toContain('402');
 expect(dto.items).toHaveLength(1);
});

const formats=[...samples,
 ['Dg6d#78b50','Diagonal 6D # 78B-50'],['Tv78c#6d48','Transversal 78C # 6D-48'],
 ['Calle 6 B # 80 G17','Calle 6B # 80G-17'],['Cra. 80b Nº 6A31','Carrera 80B # 6A-31'],
 ['CL6B#80G17','Calle 6B # 80G-17'],['Carrera 80B #6A31 Sur','Carrera 80B # 6A-31 Sur']];
for(const [input,street] of formats) for(const dish of ['Arroz Con Pollo','Bowl Andino','Ensalada Campestre'])
for(const agent of [false,true]) for(const mode of ['exact','plainOnly','abbreviationOnly','wrongDoor','wrongLetter','partial']) {
 test(`${input}/${dish}/agent=${agent}/${mode}: recover same street identity, preserve checkout`,async()=>{
  const h=harness([{id:94742,code:76,name:dish,price:18000,availableNow:true,attributes:[]}],agent);
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15,deliveryFeeTiers:[{maxKm:5.5,fee:2000}]});
  Object.assign(h.conv.sessionData,{orderType:'delivery',fulfillmentChosen:true});
  h.service.aiService.classifyMessage=jest.fn().mockResolvedValue(null);
  h.service.aiService.generateTurn=jest.fn().mockResolvedValue({reply:'¿Cómo prefieres pagar?',actions:{}});
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:474,dailyOrderNumber:474});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  const routing=new WhatsappDeliveryRoutingService({get:()=> 'test-key'} as never);
  const route=jest.spyOn(routing as any,'directionsDistance').mockResolvedValue({distanceKm:1,durationMinutes:4});
  const plain=street.replace(/[#-]/g,' ').replace(/\s+/g,' ').trim();
  const aliases:Record<string,string>={Calle:'Cl.',Carrera:'Cra.',Diagonal:'Dg.',Transversal:'Tv.'};
  const abbreviated=street.replace(/^(Calle|Carrera|Diagonal|Transversal)/,road=>aliases[road]).replace(/ # /,' #');
  const queries:string[]=[];let recovered=false;
  global.fetch=jest.fn().mockImplementation(async(url:string)=>{
   const q=new URL(url).searchParams.get('address')||'';queries.push(q);
   const hit=recovered||mode!=='plainOnly'&&mode!=='abbreviationOnly'||
    mode==='plainOnly'&&q.startsWith(plain+',')||mode==='abbreviationOnly'&&q===abbreviated+', Bogotá, Colombia';
   let formatted=street;
   if(!recovered&&mode==='wrongDoor') formatted=street.replace(/-\d+/,'-999');
   if(!recovered&&mode==='wrongLetter') formatted=street.replace(/# (\d+)[A-Z]/,'# $1Z');
   return {status:200,json:async()=>hit?{status:'OK',results:[{formatted_address:formatted+', Bogotá, Colombia',partial_match:!recovered&&mode==='partial',types:['street_address'],geometry:{location:{lat:4.64,lng:-74.14}},address_components:[{short_name:'CO',types:['country']}]}]}:{status:'ZERO_RESULTS',results:[]}};
  });
  h.service.deliveryRouting=routing;
  await h.sendQueued(`quiero dos ${dish}`);await h.sendQueued('nada más');
  const cart=structuredClone(h.conv.sessionData.cart);
  const response=await h.sendQueued(input+' torre 3 apto 402');
  expect(canonicalStreetAddress(input)).toBe(street);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(queries.length).toBeLessThanOrEqual(12);
  expect(queries.every(q=>!/torre|apto|402/i.test(q))).toBe(true);
  if(['wrongDoor','wrongLetter','partial'].includes(mode)) {
   expect(response).toMatch(/ubicación|direcci[oó]n/i);
   expect(route).not.toHaveBeenCalled();
   await h.sendQueued('confirmar');
   expect(h.service.ordersService.create).not.toHaveBeenCalled();
   recovered=true;
   await h.sendQueued(input+' torre 3 apto 402');
  }
  expect(h.conv.sessionData.deliveryFeeCalculated).toBe(2000);
  expect(h.conv.sessionData.cart).toEqual(cart);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('en efectivo');await h.sendQueued('confirmar');
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.items).toHaveLength(2);
  expect(dto.items.every((item:any)=>item.productId===94742)).toBe(true);
  expect(canonicalStreetAddress(dto.address)).toBe(street);
  expect(dto.address).toContain('402');
  expect(h.conv.state).toBe('completed');
 });
}
for(const raw of ['Calle 6B #8017','Cra80B#631','Dg6D#7850','Tv78C#648'])
 test(`does not invent a boundary in an all-numeric plate: ${raw}`,()=>expect(canonicalStreetAddress(raw)).toBeNull());
