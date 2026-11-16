import { harness } from './whatsapp-accuracy.test-support';
import { WhatsappAgentService } from './whatsapp-agent.service';
import { WhatsappCatalogService } from './whatsapp-catalog.service';
import { interpretProductNote } from './whatsapp-product-intent';
import { kitchenDescriptionNote } from './whatsapp-kitchen-description';
import { DEFAULT_PAYMENT_METHODS } from './whatsapp-payment-methods';
const products=[
 {id:54801,code:1,name:'1 Pollo Frito',price:44000,availableNow:true,attributes:[]},
 {id:54802,code:2,name:'Tofu a La Plancha',price:25000,availableNow:true,attributes:[]},
 {id:54803,code:3,name:'Filete Vegetal',price:27000,availableNow:true,attributes:[]},
];
const call=(name:string,args:unknown)=>({id:'call-'+name,type:'function',function:{name,arguments:JSON.stringify(args)}});
const answer=(calls?:unknown[])=>new Response(JSON.stringify({choices:[{message:{content:calls?null:'Listo',tool_calls:calls}}]}),{status:200});
function setup(){
 const h=harness(products,true);h.conv.sessionData={cart:[],orderType:'delivery'};
 h.service.settingsService.semanticRoutingEnabled=()=>true;
 h.service.conversationService.saveSemanticSession=jest.fn(async(_conv,expected,next,state,name)=>{
  if(h.conv.state!==expected.state||JSON.stringify(h.conv.sessionData)!==JSON.stringify(expected.session))return false;
  h.conv.sessionData=structuredClone(next);h.conv.state=state;if(name)h.conv.customerName=name;return true;
 });
 h.service.agentService=new WhatsappAgentService({getEffectiveConfig:async()=>({openaiApiKey:'synthetic',openaiModel:'gpt-4o-mini',systemPrompt:'',aiTemperature:0.2,localContext:{},paymentMethods:DEFAULT_PAYMENT_METHODS})} as never,new WhatsappCatalogService({} as never));
 return h;
}
beforeEach(()=>jest.spyOn(global,'fetch').mockRejectedValue(new Error('Unexpected network in free regression')));
afterEach(()=>jest.restoreAllMocks());
const descriptions=[
 'que este bien jugoso por favor 🙏','que esté jugosito porfa 😊','que salga tierno gracias 👍',
 'que esté fresco por favor','que esté bien doradito por favor 🙏','que llegue caliente porfa 🙏',
 'que no esté tan seco gracias','que quede bien jugoso por favor','que venga jugoso y caliente porfa',
 'bien jugoso por favor 🙏','jugosito porfa','lo quiero bien jugoso','lo quisiera tierno',
];
for(const product of products) for(const description of descriptions) it(`a full purchase retains its preparation note ${product.name}/${description}`,async()=>{
 const h=setup();const named=product.id===54801?'Un pollo frito':`Un ${product.name}`;const text=`${named} ${description}`;
 const note=kitchenDescriptionNote(description);expect(note).toBeTruthy();
 jest.spyOn(global,'fetch').mockResolvedValueOnce(answer([call('interpret_message',{segments:[{text,role:'purchase',productIds:[product.id]}]})]))
  .mockResolvedValueOnce(answer([call('add_item',{sourceText:text,productId:product.id,quantity:1,note})]))
  .mockResolvedValueOnce(answer());
 const reply=await h.sendQueued(text);
 expect(reply).not.toMatch(/aclaras qué quieres|no entend|no manejamos/i);
 expect(h.conv.sessionData.cart).toEqual([expect.objectContaining({productId:product.id,quantity:1,note:expect.stringMatching(/jugos|tiern|fresc|dorad|caliente|seco/i)})]);
});
for(const source of ['que tenga langosta','que traiga dos hamburguesas','que esté jugoso y un arroz','que esté jugoso?','que esté asado']) it(`unavailable ingredients and new purchases remain outside a preparation note ${source}`,()=>{
 expect(kitchenDescriptionNote(source)).toBeNull();
});

for(const state of ['building_cart','awaiting_name','awaiting_address','awaiting_payment','awaiting_final_confirm']) it(`an empty cart receipt resumes a purchase without promising dispatch ${state}`,async()=>{
 const h=setup();h.conv.state=state;h.conv.sessionData.paymentMethod='transfer';
 h.service.metaService={downloadMedia:jest.fn().mockResolvedValue({buffer:Buffer.from('isolated'),mimeType:'image/png'})};
 h.service.aiService.analyzeOrderImage=jest.fn().mockResolvedValue({kind:'payment_proof',reply:'Pedido listo y pago aprobado'});
 h.service.conversationService.updateMessageBody=jest.fn();h.service.ordersService.create=jest.fn();
 const reply=await h.service.paymentProofAcknowledgement(h.conv);
 expect(reply).toMatch(/equipo lo validará/);expect(reply).toMatch(/qué deseas pedir/i);
 expect(reply).not.toMatch(/enviaremos|pago aprobado|confirmado/i);
 await h.service.resolveImageMessage({waId:'customer',messageType:'image',mediaId:'synthetic'},'logged',h.conv,h.cfg);
 expect(h.replies.at(-1)).not.toMatch(/enviaremos|pago aprobado/i);
 expect(h.conv.sessionData.cart).toEqual([]);expect(h.conv.state).toBe(state);expect(h.service.ordersService.create).not.toHaveBeenCalled();
});
for(const state of ['completed','closed']) it(`a receipt after a registered order keeps the requested friendly acknowledgement ${state}`,()=>{
 const h=setup();h.conv.state=state;
 expect(h.service.paymentProofAcknowledgement(h.conv)).toBe('Recibí el comprobante. El equipo lo validará. Te enviaremos el pedido lo más pronto posible.');
});
it('a receipt preserves a pending product decision and asks that one question',()=>{
 const h=setup();h.conv.sessionData.pendingMatch={intent:'order',quantity:1,query:'plato',candidates:products.slice(0,2)};
 const reply=h.service.paymentProofAcknowledgement(h.conv);
 expect(reply).toContain(products[0].name);expect(reply).toContain(products[1].name);expect(reply).not.toMatch(/enviaremos|qué deseas pedir/i);
});

it('a preparation note never substitutes an unavailable cooking style',()=>{
 expect(interpretProductNote('Un pollo asado bien jugoso',[products[0]])).toBeNull();
});
it('an exact longer catalogue name owns its adjective',()=>{
 const named={...products[0],id:54804,name:'1 Pollo Frito Jugoso'};
 expect(interpretProductNote('Un pollo frito jugoso',[products[0],named])).toBeNull();
});
it('a fractional catalogue name retains its size when separating its note',()=>{
 const half={...products[0],id:54805,name:'1/2 Pollo Frito'};
 expect(interpretProductNote('medio pollo frito bien jugoso',[products[0],half])).toMatchObject({productId:54805,productText:'medio pollo frito',note:'bien jugoso'});
});
it('a question about a descriptive product remains a question',()=>{
 expect(interpretProductNote('Un pollo frito bien jugoso?',[products[0]])).toBeNull();
});
