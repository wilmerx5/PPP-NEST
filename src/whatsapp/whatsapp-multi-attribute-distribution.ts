import { expandDistributionRemainder } from './whatsapp-distribution-remainder';
type Attribute = {attributeName:string;options:string[]};
type Selection = {attributeName:string;attributeValue:string};

/** Explicit complete groups only; reject multiple catalog interpretations or excessive search. */
export function parseMultiAttributeDistribution(text:string, attributes:Attribute[], total:number): Array<{quantity:number;attributes:Selection[]}> | null {
 const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 if(attributes.length<2 || attributes.length>4 || !Number.isSafeInteger(total) || total<2 || total>99 || text.length>400 || /[¿?]/.test(text))return null;
 if(attributes.some(a=>!a.options.length || a.options.length>32))return null;
 const counts:Record<string,number>={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
 const normalized=normalize(text).replace(/[.!]+$/,'').replace(/(?:,?\s+(?:porfa|por favor|gracias))$/,'');
 const raw=expandDistributionRemainder(normalized,total);
 if(raw===null)return null;
 const parts=raw.split(/\s*(?:,|;|\by\b)\s*(?=(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|[1-9]\d?)\s)/);
 if(parts.length<2 || parts.length>8)return null;
 const groups=new Map<string,{quantity:number;attributes:Selection[]}>();
 let budget=2048;
 for(const part of parts){
  const match=part.match(/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|[1-9]\d?)\s+(.+)$/);
  if(!match)return null;
  const solutions:Selection[][]=[];
  const visit=(rest:string,chosen:Map<number,string>)=>{
   if(--budget<0 || solutions.length>1)return;
   if(chosen.size===attributes.length){
    if(!rest)solutions.push(attributes.map((a,i)=>({attributeName:a.attributeName,attributeValue:chosen.get(i)!})));
    return;
   }
   // Each option is separated by a catalog value boundary, optionally de/con/en/y.
   const bodies=[...new Set([rest,rest.replace(/^(?:de|con|en|y)\s+/,'')])];
   for(let i=0;i<attributes.length;i++){
    if(chosen.has(i))continue;
    for(const option of attributes[i].options){
     const value=normalize(option);if(!value)continue;
     for(const body of bodies){
      if(body!==value && !body.startsWith(value+' '))continue;
      const next=new Map(chosen);next.set(i,option);visit(body.slice(value.length).trim(),next);
     }
    }
   }
  };
  visit(match[2],new Map());
  if(budget<0 || solutions.length!==1)return null;
  const selected=solutions[0],key=JSON.stringify(selected),quantity=counts[match[1]]??Number(match[1]);
  const previous=groups.get(key);groups.set(key,{quantity:quantity+(previous?.quantity||0),attributes:selected});
 }
 const result=[...groups.values()];
 return result.reduce((sum,g)=>sum+g.quantity,0)===total?result:null;
}
