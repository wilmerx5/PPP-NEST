import {WhatsappOrchestratorService} from './whatsapp-orchestrator.service';
import {WhatsappCatalogService} from './whatsapp-catalog.service';

describe('Explicit combo conversion only absorbs one unambiguous compatible bottle',()=>{
 const food={id:1,code:1,name:'Sandwich Serrano',price:18000};
 const combo={id:2,code:2,name:'Combo De Sandwich Serrano',price:24000,description:'Incluye bebida de 1.5L',attributes:[{attributeName:'Bebida',options:['Te De Durazno','Te De Limon']}]};
 const drink={id:3,code:3,name:'Te De Durazno 1.5L',categoryName:'Bebidas',price:6000};
 const original={productId:1,code:1,name:food.name,unitPrice:18000,quantity:1};
 const line={productId:3,code:3,name:drink.name,unitPrice:6000,quantity:1};
 const service=Object.create(WhatsappOrchestratorService.prototype) as any;service.catalogService=new WhatsappCatalogService({} as never);
 const text='el Sandwich Serrano damelo en combo con Te De Durazno';
 function run(changes:any={},source=text,more:any[]=[],product:any=combo){
  const session={cart:[{productId:2,code:2,name:combo.name,unitPrice:24000,quantity:1},{...line,...changes},...more]};const before=structuredClone(session);const result=service.absorbExplicitComboDrink(session,original,product,source,[food,combo,drink]);expect(session).toEqual(before);return result;
 }
 it('absorbs exactly the matching single bottle after conversion',()=>expect(run().cart).toHaveLength(1));
 it('keeps extra bottles',()=>expect(run({quantity:2}).cart).toHaveLength(2));
 it('keeps a bottle with an individual note',()=>expect(run({note:'Para Ana'}).cart).toHaveLength(2));
 it('keeps an explicit separate beverage',()=>expect(run({},text+' aparte').cart).toHaveLength(2));
 it('does not guess between two matching lines',()=>expect(run({},text,[{...line,attributes:[{attributeName:'Sabor',attributeValue:'Original'}]}]).cart).toHaveLength(3));
 it('does not absorb a different volume',()=>expect(run({},text,[],{...combo,description:'Incluye bebida de 400ml'}).cart).toHaveLength(2));
 it('does not absorb when the included volume is undocumented',()=>expect(run({},text,[],{...combo,description:''}).cart).toHaveLength(2));
 it('does not absorb on an ordinary combo mention',()=>expect(run({},'quiero un combo con Te De Durazno').cart).toHaveLength(2));
});

describe('Explicit con-drink segmentation follows the catalogue host attributes',()=>{
 const catalog=new WhatsappCatalogService({} as never);
 const main={id:11,code:11,name:'Bowl Andino',price:16000,availableNow:true,hasAttributes:false,attributes:[]};
 const drink={id:12,code:12,name:'Infusion De Jamaica',categoryName:'Bebidas',price:5000,availableNow:true,hasAttributes:false,attributes:[]};
 it('separates an explicitly named drink from food without a beverage option',()=>expect(catalog.splitMultiProductSegments('Quiero un Bowl Andino con Infusion De Jamaica',[main,drink])).toHaveLength(2));
 it('keeps an included drink attached to its host',()=>expect(catalog.splitMultiProductSegments('Quiero un Bowl Andino con Infusion De Jamaica',[{...main,hasAttributes:true,attributes:[{attributeName:'Bebida',options:['Infusion De Jamaica','Agua']} ]},drink])).toHaveLength(1));
 it('does not turn an unknown condiment into a separate product',()=>expect(catalog.splitMultiProductSegments('Quiero un Bowl Andino con salsa especial',[main,drink])).toHaveLength(1));
 it('does not split a complete product name containing con',()=>expect(catalog.splitMultiProductSegments('Quiero un Tostado Con Queso',[{...main,name:'Tostado Con Queso'},drink])).toHaveLength(1));
});

describe('Bottle volume formatting does not erase the selected flavour when included in a combo',()=>{
 for(const size of ['1.5L','1,5 litros','1500ml'])for(const selected of ['Original','Ligero'])for(const target of ['Original','Ligero'])it(`${size}, bottle=${selected}, combo=${target}`,()=>{
  const service=Object.create(WhatsappOrchestratorService.prototype) as any;service.catalogService=new WhatsappCatalogService({} as never);
  const food={id:21,code:21,name:'Bowl De Quinoa',price:18000};const bottle={id:22,code:22,name:`Refresco De Cereza ${size}`,categoryName:'Bebidas',price:6000,attributes:[{attributeName:'Sabor',options:['Original','Ligero']}]};const combo={id:23,code:23,name:'Combo De Bowl De Quinoa',price:24000,description:'Incluye bebida de 1.5L',attributes:[{attributeName:'Bebida',options:['Refresco De Cereza','Refresco De Cereza Ligero']}]};
  const requested=target==='Ligero'?'Refresco De Cereza Ligero':'Refresco De Cereza';const session={cart:[{productId:23,name:combo.name,quantity:1},{productId:22,name:bottle.name,quantity:1,attributes:[{attributeName:'Sabor',attributeValue:selected}]}]};const before=structuredClone(session);
  const result=service.absorbExplicitComboDrink(session,{productId:21,quantity:1},combo,`el Bowl De Quinoa damelo en combo con ${requested}`,[food,bottle,combo]);expect(session).toEqual(before);expect(result.cart).toHaveLength(selected===target?1:2);
 });
});
