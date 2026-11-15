import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappConversation } from './entities/whatsapp-conversation.entity';

function setup() {
  const row:any={id:541,state:'building_cart',customerName:'Natalia',humanTakeover:false,
    sessionData:{cart:[{productId:1,name:'Sopa',quantity:1,unitPrice:5000}],orderType:'pickup'}};
  const persisted=structuredClone(row);
  const repository={findOne:jest.fn(async()=>structuredClone(persisted)),save:jest.fn(async next=>Object.assign(persisted,structuredClone(next)))};
  const manager={getRepository:jest.fn(target=>{expect(target).toBe(WhatsappConversation);return repository;})};
  const convRepo={manager:{transaction:jest.fn(async run=>run(manager))}};
  const service=new WhatsappConversationService(convRepo as never,{} as never,{} as never,{} as never);
  const expected={session:service.getSession(row),state:row.state,customerName:row.customerName};
  const next={...expected.session,cart:[{...expected.session.cart[0],quantity:2}]};
  return {row,persisted,repository,service,expected,next};
}

it('the semantic decision and customer name commit in one locked persistence operation',async()=>{
  const h=setup();
  expect(await h.service.saveSemanticSession(h.row,h.expected,h.next,'building_cart','Nicol Campos')).toBe(true);
  expect(h.repository.findOne).toHaveBeenCalledWith({where:{id:541},lock:{mode:'pessimistic_write'}});
  expect(h.repository.save).toHaveBeenCalledTimes(1);
  expect(h.persisted.sessionData.cart[0].quantity).toBe(2);
  expect(h.persisted.customerName).toBe('Nicol Campos');expect(h.row.customerName).toBe('Nicol Campos');
});
for(const change of ['cart','name','state','takeover','missing']) it(`a stale ${change} cannot be overwritten by an earlier interpretation`,async()=>{
  const h=setup();
  if(change==='cart')h.persisted.sessionData.cart[0].quantity=3;
  if(change==='name')h.persisted.customerName='María';
  if(change==='state')h.persisted.state='awaiting_payment';
  if(change==='takeover')h.persisted.humanTakeover=true;
  if(change==='missing')h.repository.findOne.mockResolvedValue(null);
  expect(await h.service.saveSemanticSession(h.row,h.expected,h.next,'building_cart')).toBe(false);
  expect(h.repository.save).not.toHaveBeenCalled();
});
it('a failed commit never announces an in-memory mutation as persisted',async()=>{
  const h=setup();const before=structuredClone(h.row);
  h.repository.save.mockRejectedValue(new Error('synthetic DB failure'));
  await expect(h.service.saveSemanticSession(h.row,h.expected,h.next,'building_cart','Otra Persona')).rejects.toThrow();
  expect(h.row).toEqual(before);
});
