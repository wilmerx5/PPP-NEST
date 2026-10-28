import {resolveWhatsappAgentModel,resolveWhatsappAgentRoute} from './whatsapp-agent-model';
const tiered={WHATSAPP_AGENT_MODEL:'gpt-6-luna',WHATSAPP_AGENT_COMPLEX_MODEL:'gpt-6.1-sol'};
describe('Agent routing before tool execution',()=>{
 it.each(['Agrega dos sopas','Cambia la bebida por limonada','¿Cuánto cuesta todo?','Pago contraentrega'])('uses the primary for a usual turn: %s',text=>{
  expect(resolveWhatsappAgentRoute(undefined,text,tiered)).toEqual({model:'gpt-6-luna',reason:'primary'});
 });
 it.each(['Dos platos, si no tienen postre no lo reemplaces','Si hay yuca, la prefiero','Una mitad sin cebolla y la otra normal','Para cada persona una salsa distinta'])('routes a complex turn upfront: %s',text=>{
  expect(resolveWhatsappAgentRoute(undefined,text,tiered).model).toBe('gpt-6.1-sol');
 });
 it('leaves the comparison candidate pure unless the complex model is explicitly enabled',()=>{
  expect(resolveWhatsappAgentRoute('gpt-6-luna','Si no hay postre, omítelo',{}).model).toBe('gpt-6-luna');
 });
 it('preserves an explicitly configured Sol primary',()=>{
  expect(resolveWhatsappAgentRoute('gpt-6.1-sol','Un plato',{WHATSAPP_AGENT_COMPLEX_MODEL:'gpt-6.1-sol'}).model).toBe('gpt-6.1-sol');
 });
 it('preserves the previous configuration fallback',()=>expect(resolveWhatsappAgentModel(undefined,{})).toBe('gpt-4o-mini'));
});
