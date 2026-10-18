import {kitchenDescriptionNote,splitKitchenDescription} from './whatsapp-kitchen-description';
import {interpretProductNote} from './whatsapp-product-intent';

describe('Anchored kitchen descriptions preserve wording without consuming purchases',()=>{
 it.each(['dorada, bien bonita que no esté tan gorda','bien cocinados, que no me vayan a salir crudos','bien cocinadas, que no me vayan a salir crudas','bien doradita, que no venga tan gruesa','delgadita','dorda, bien bonita que no esté tan torda','muy crocante','que no esté muy seca','que venga bien caliente','que no nos vaya a salir cruda'])('keeps literal preference %s',note=>{
  expect(kitchenDescriptionNote(note)).toBe(note);
 });
 it.each(['bien cocinada y una gaseosa','bien bonita más dos papas','que me agreguen un postre','que no esté tan cruda; y dos jugos','¿la sirven bien cocinada?','bien cocinada para calle 12 34 56','pollo a la plancha','sin ensalada','bien dorada con camarones','bien bonita y hamburguesa'])('does not absorb another intent: %s',source=>{
  expect(kitchenDescriptionNote(source)).toBeNull();
 });
 it('keeps courtesy out of a relative cooking note',()=>{
  expect(splitKitchenDescription('Quiero dos pollos pero bien cocinados, que no me vayan a salir crudos por favor')).toEqual({productText:'Quiero dos pollos',note:'bien cocinados, que no me vayan a salir crudos'});
 });
 it('requires an anchor for an unqualified adjective',()=>{
  expect(splitKitchenDescription('Quiero una berenjena delgadita')).toBeNull();
  expect(interpretProductNote('Quiero una Berenjena delgadita',[{id:1,name:'Berenjena'}])).toMatchObject({productId:1,note:'delgadita'});
 });
});

describe('Intensity preferences remain bounded and catalogue anchored',()=>{
 it.each(['no tan dulce','que no venga tan dulce','que no esté tan salado','no tan picante','que no esté tan ácida','que no venga tan grasosa','muy dulce','no muy picante','un poco salado','que no sea demasiado ácido'])('preserves wording: %s',note=>expect(kitchenDescriptionNote(note)).toBe(note));
 it.each(['no tan dulce y dos cafés','que no esté tan salado con camarones','que no venga tan grasosa para calle 12 34 56','¿puede venir no tan picante?','sin gluten garantizado','soy alérgico a la leche','que sea seguro para celíacos','que no esté tan ácida; y un postre'])('does not swallow another request or safety condition: %s',note=>expect(kitchenDescriptionNote(note)).toBeNull());
 it.each(['Dulce','Picante','Salado','Ácido','Grasoso'])('preserves a longer exact named SKU: %s',suffix=>{
  const products=[{id:1,name:'Especial'},{id:2,name:`Especial ${suffix}`}];
  expect(interpretProductNote(`Quiero un Especial ${suffix}`,products)).toBeNull();
 });
});

describe('Degree phrases and explicit options have separate ownership',()=>{
 const {splitIntensityPreference}=require('./whatsapp-kitchen-description');
 const {WhatsappCatalogService}=require('./whatsapp-catalog.service');
 const catalog=new WhatsappCatalogService({});
 it.each(['no tan picante','no muy dulce','que no esté tan salado'])('does not choose the adjective in %s',text=>{
  expect(catalog.pickAttributeOptionFromText(text,{attributeName:'Estilo',options:['Natural','Picante','Dulce','Salado']})).toBeNull();
 });
 it.each(['Picante','Dulce','Salado'])('keeps a bare explicit option %s',value=>expect(catalog.pickAttributeOptionFromText(value,{attributeName:'Estilo',options:['Natural',value]})).toBe(value));
 it('keeps an option explicitly chosen before its degree preference',()=>{
  const source='con Salsa Picante, pero no tan picante';expect(splitIntensityPreference(source)).toEqual({productText:'con Salsa Picante',note:'no tan picante'});
  expect(catalog.pickAttributeOptionFromText(source,{attributeName:'Salsa',options:['Suave','Picante']})).toBe('Picante');
 });
 it('does not erase a literal full catalogue option',()=>expect(catalog.pickAttributeOptionFromText('No Tan Picante',{attributeName:'Salsa',options:['Natural','No Tan Picante']})).toBe('No Tan Picante'));
 it.each(['no tan picante y dos cafés','que no esté tan salado con camarones','¿no tan dulce?'])('does not split another intent: %s',source=>expect(splitIntensityPreference(source)).toBeNull());
});

describe('Real purchase tools retain degree notes and override contradictory valid model choices',()=>{
 const {WhatsappCatalogService}=require('./whatsapp-catalog.service');const {WhatsappAgentService}=require('./whatsapp-agent.service');
 for(const f of [{name:'Curry de Garbanzos',attr:'Salsa',base:'Suave',other:'Picante',note:'no tan picante'},{name:'Ramen Vegetal',attr:'Caldo',base:'Natural',other:'Salado',note:'que no esté tan salado'},{name:'Flan Artesanal',attr:'Cobertura',base:'Tradicional',other:'Dulce',note:'no tan dulce'}])for(const explicit of [false,true])it(`${f.name} explicit=${explicit}`,()=>{
  const product={id:65611,code:65611,name:f.name,price:18000,availableNow:true,hasAttributes:true,attributes:[{attributeName:f.attr,options:[f.base,f.other]}]};const catalog=new WhatsappCatalogService({});const service=new WhatsappAgentService({},catalog);const actions:any={};
  const source=`Quiero dos ${f.name}${explicit?` con ${f.attr} ${f.other}, pero`:''} ${f.note} por favor`;
  const result=JSON.parse(service.executeTool('add_item',{productId:product.id,quantity:2,attributes:[{attributeName:f.attr,attributeValue:explicit?f.base:f.other}]},{actions,cart:[],products:[product],byId:new Map([[product.id,product]]),userMessage:source,setNeedsAttr:()=>{}}));
  expect(result.ok).toBe(true);expect(actions.addItems[0].quantity).toBe(2);expect(actions.addItems[0].attributes).toEqual([{attributeName:f.attr,attributeValue:explicit?f.other:f.base}]);expect(actions.addItems[0].note).toContain(f.note);
 });
});
