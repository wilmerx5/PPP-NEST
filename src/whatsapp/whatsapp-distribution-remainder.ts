/** Resolve one final remainder against the pending addition, never against the whole cart.
 * Input is already normalized. Downstream parsers still validate all catalog options.
 */
export function expandDistributionRemainder(raw:string,total:number):string | null {
 const marker='(?:el resto|l[oa]s demas|l[oa]s restantes)';
 const count='(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|[1-9]\\d?)';
 const parts=raw.split(new RegExp('\\s*(?:,|;|\\by\\b)\\s*(?=(?:'+count+'|'+marker+')\\s)'));
 const remainder=new RegExp('^'+marker+'\\s+(.+)$');
 const indices=parts.flatMap((p,i)=>remainder.test(p)?[i]:[]);
 if(!indices.length)return raw;
 if(!Number.isSafeInteger(total)||total<2||total>99||parts.length<2||parts.length>8||indices.length!==1||indices[0]!==parts.length-1)return null;
 const values:Record<string,number>={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
 let used=0;
 for(const part of parts.slice(0,-1)){
  const match=part.match(new RegExp('^('+count+')\\s+.+$'));
  if(!match)return null;
  used+=values[match[1]]??Number(match[1]);
 }
 const remaining=total-used;if(remaining<1)return null;
 parts[parts.length-1]=remaining+' '+parts.at(-1)!.match(remainder)![1];
 return parts.join('; ');
}
