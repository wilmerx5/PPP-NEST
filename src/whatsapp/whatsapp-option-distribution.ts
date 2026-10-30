import { expandDistributionRemainder } from './whatsapp-distribution-remainder';
/** A complete, explicit distribution of one catalog option across all pending units. */
export function parseOptionDistribution(text: string, options: string[], total: number): Array<{quantity:number;value:string}> | null {
 const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 if(!Number.isSafeInteger(total)||total<2||total>99||text.length>400||/[¿?]/.test(text))return null;
 const normalized=normalize(text).replace(/[.!]+$/,'').replace(/(?:,?\s+(?:porfa|por favor|gracias))$/,'');
 const raw=expandDistributionRemainder(normalized,total);
 if(raw===null)return null;
 const parts=raw.split(/\s*(?:,|;|\by\b)\s*/);
 if(parts.length<2||parts.length>8||parts.some(part=>!part))return null;
 const counts:Record<string,number>={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
 const groups=new Map<string,number>();
 for(const part of parts){
  const match=part.match(/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|[1-9]\d?)\s+(?:(?:de|con)\s+)?(.+)$/);
  if(!match)return null;
  const quantity=counts[match[1]]??Number(match[1]);
  const values=options.filter(option=>normalize(option)===match[2]);
  if(values.length!==1)return null;
  groups.set(values[0],(groups.get(values[0])||0)+quantity);
 }
 if([...groups.values()].reduce((a,b)=>a+b,0)!==total)return null;
 return [...groups].map(([value,quantity])=>({quantity,value}));
}
