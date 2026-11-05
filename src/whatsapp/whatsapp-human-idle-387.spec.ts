import { WhatsappCleanupService } from './whatsapp-cleanup.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';

for(const state of ['completed','closed','confirming','building_cart'])for(const released of [false,true])it(`idle release preserves ${state}, conditional success=${released}`,async()=>{
 const live={id:1,state,humanTakeover:!released,sessionData:{cart:[{productId:1,quantity:1}]}};
 const initial=structuredClone(live.sessionData);
 const conversations:any={findAgentIdleTakeovers:jest.fn().mockResolvedValue([]),findClientIdleTakeovers:jest.fn().mockResolvedValue([live]),findIdlePendingChoices:jest.fn().mockResolvedValue([]),findIdleMpPayments:jest.fn().mockResolvedValue([]),findIdleOrderDrafts:jest.fn().mockResolvedValue([]),releaseIdleHumanTakeover:jest.fn().mockResolvedValue(released),reloadConversation:jest.fn().mockResolvedValue(live),resetOrderSession:jest.fn(),logMessage:jest.fn(),touchOutbound:jest.fn()};
 const meta={sendText:jest.fn()};const service=new WhatsappCleanupService(conversations,{getEffectiveConfig:async()=>({humanClientIdleMinutes:15})} as any,meta as any);
 await (service as any).runSessionExpiry();expect(live.sessionData).toEqual(initial);expect(conversations.resetOrderSession).not.toHaveBeenCalled();
 expect(meta.sendText).toHaveBeenCalledTimes(released&&state==='building_cart'?1:0);
});
it.each([0,1])('atomic idle release only succeeds for an affected row: %i',async affected=>{
 const q:any={execute:jest.fn().mockResolvedValue({affected})};for(const key of ['update','set','where','andWhere'])q[key]=jest.fn().mockReturnValue(q);
 const service=new WhatsappConversationService({createQueryBuilder:()=>q} as any,{} as any,{} as any,{} as any);
 expect(await service.releaseIdleHumanTakeover(1,15)).toBe(!!affected);
 expect(q.set).toHaveBeenCalledWith(expect.not.objectContaining({sessionData:expect.anything()}));
 expect(q.andWhere).toHaveBeenCalledWith(expect.stringMatching(/GREATEST.*last_inbound_at.*last_human_outbound_at.*human_takeover_at/),{m:15});
});
