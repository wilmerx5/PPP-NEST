import {harness} from './whatsapp-accuracy.test-support';
for(const agent of [false,true]) it(`long order + recovery, agent=${agent}`,async()=>{
 const h=harness(undefined,agent);h.conv.customerName=null as any;
 const transcript: unknown[]=[];
 for(const text of ['Hola buenas tardes','Oye para pedir 2 pollos','Hay plátano','El frito es el mismo que el asado?','Hay gaseosa','Me das un pollo frito y uno a la broster si tienes yuca mejor para que uno venga con papas y el otro con yuca y 2 plátanos con queso y bocadillo por favor','Es un pollo frito y uno a la broster','Ósea 1 y 1 y los 2 plátanos']){
  const at=h.replies.length;await h.sendQueued(text);
  transcript.push({text,replies:h.replies.slice(at),cart:structuredClone(h.conv.sessionData.cart),state:h.conv.state,name:h.conv.customerName});
 }
 require('fs').writeFileSync(`/tmp/ppp-191-replay-${agent}.json`,JSON.stringify(transcript,null,2));
 expect(h.conv.sessionData.cart.map(line=>[line.code,line.quantity]).sort()).toEqual([[1,1],[4,1],[53,2]].sort());
 expect(h.conv.sessionData.cart.some(line=>/bocadillo por/i.test(line.note||''))).toBe(false);
});
