import { mergeCoalescedInboundMessages } from './whatsapp-inbound-coalesce';
import { IncomingWhatsappMessage } from './whatsapp-meta.service';
function msg(id:string,profileName?:string):IncomingWhatsappMessage {return {waId:'573000000001',phoneE164:'+573000000001',messageId:id,messageType:'text',text:id,timestamp:1,raw:{},profileName};}
it('keeps profile that arrives on the second bubble',()=>expect(mergeCoalescedInboundMessages([msg('a'),msg('b','Laura García')]).profileName).toBe('Laura García'));
it('keeps consistent profiles',()=>expect(mergeCoalescedInboundMessages([msg('a','Laura García'),msg('b','Laura García')]).profileName).toBe('Laura García'));
it('does not select conflicting profiles in a burst',()=>expect(mergeCoalescedInboundMessages([msg('a','Laura García'),msg('b','Katherine Agudelo')]).profileName).toBeUndefined());
it('does not borrow a profile from another sender',()=>expect(mergeCoalescedInboundMessages([msg('a'),{...msg('b','Laura García'),waId:'573000000002'}]).profileName).toBeUndefined());
