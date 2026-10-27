import { WhatsappMetaService } from './whatsapp-meta.service';
import { harness } from './whatsapp-accuracy.test-support';

const parser = new WhatsappMetaService({} as never);
function parse(contacts: any[], type = 'text') {
 return parser.parseWebhookPayload({object: 'whatsapp_business_account', entry: [{changes: [{value: {contacts, messages: [{from: '573000000001', id: 'profile-1', type, text: {body: 'hola'}, audio: {id: 'audio-1'}, image: {id: 'image-1'}}]}}]}]})[0] as any;
}
for (const type of ['text', 'audio', 'image']) it(`profile follows matching contact for ${type}`, () => {
 expect(parse([{wa_id: '573000000002', profile: {name: 'Otra Persona'}}, {wa_id: '573000000001', profile: {name: '  Katherine   Agudelo '}}], type).profileName).toBe('Katherine Agudelo');
});
for (const name of ['', '😀', 'Cliente', 'Katy', 'Pedidos Restaurante', 'Tienda Central', 'Calle 10 81A', 'Juan123 Pérez', 'Hola buenas tardes']) it(`does not auto-use profile ${name}`, () => {
 expect(parse([{wa_id: '573000000001', profile: {name}}]).profileName).toBeUndefined();
});
it('does not borrow another contact name', () => expect(parse([{wa_id: '573000000002', profile: {name: 'Otra Persona'}}]).profileName).toBeUndefined());
it('does not choose conflicting duplicate contacts', () => expect(parse([{wa_id:'573000000001',profile:{name:'Laura García'}},{wa_id:'573000000001',profile:{name:'Katherine Agudelo'}}]).profileName).toBeUndefined());
for (const product of ['Arroz Con Pollo', 'Pizza Margarita', 'Bowl Vegetal']) for (const agent of [false,true]) for (const mode of ['empty','saved','correction','inline']) {
 it(`profile recipient checkout ${product}/${agent}/${mode}`, async () => {
  const h=harness([{id:42,code:42,name:product,price:20000,availableNow:true,attributes:[]}],agent);
  h.conv.customerName=mode==='saved'?'Laura García':'';
  Object.assign(h.cfg,{deliveryFeeMode:'distance',restaurantLat:4.63,restaurantLng:-74.15});
  h.service.deliveryRouting={quoteDeliveryFee:jest.fn().mockResolvedValue({ok:true,fee:2000,distanceKm:0.6,source:'google_directions',customer:{lat:4.63,lng:-74.15}})};
  h.service.ordersService.create=jest.fn().mockResolvedValue({id:997,dailyOrderNumber:97});
  h.service.ordersService.findTodayOrdersByPhone=jest.fn().mockResolvedValue([]);
  Object.assign(h.conv.sessionData,{phoneConfirmed:true,contactPhone:h.conv.phoneE164,notesCollected:true});
  const profile={profileName:'Katherine Agudelo'};
  await h.sendQueued(`Me das un ${product} para Calle 10 #81A-20${mode==='inline'?'\nA nombre de Laura García':''}`,profile);
  const expected=mode==='empty'?'Katherine Agudelo':'Laura García';
  expect(h.replies.at(-1)).toMatch(/cómo pagas|método de pago/i);
  expect(h.conv.sessionData.cart).toHaveLength(1);
  if(mode==='correction') await h.sendQueued('A nombre de Laura García',profile);
  expect(h.conv.customerName).toBe(expected);
  await h.sendQueued('contraentrega',profile);
  expect(h.replies.at(-1)).toContain(expected);
  expect(h.replies.at(-1)).toMatch(/confirmar/i);
  expect(h.service.ordersService.create).not.toHaveBeenCalled();
  await h.sendQueued('confirmar',profile);
  expect(h.service.ordersService.create).toHaveBeenCalledTimes(1);
  const dto=h.service.ordersService.create.mock.calls[0][0];
  expect(dto.customerName).toBe(expected);expect(dto.items).toHaveLength(1);expect(dto.items[0].productId).toBe(42);
  expect(h.conv.state).toBe('completed');
 });
}

for (const mode of ['duplicate','human','invalid']) it(`does not fill profile during ${mode}`, async () => {
 const h=harness([],false);h.conv.customerName='';
 if(mode==='duplicate') h.service.conversationService.claimInboundMessage=jest.fn().mockResolvedValue(null);
 if(mode==='human') (h.conv as any).humanTakeover=true;
 await h.sendQueued('Hola',{profileName:mode==='invalid'?'😀':'Katherine Agudelo'});
 expect(h.conv.customerName).toBe('');
});
