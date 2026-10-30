/** Resolve a complete set of remaining options, without guessing partial assignments. */
export function parseCombinedOptions(text: string, attributes: Array<{attributeName:string;options:string[]}>): Array<{attributeName:string;attributeValue:string}> | null {
 const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 if(attributes.length<2 || attributes.length>8 || text.length>400 || /[¿?]/.test(text))return null;
 const raw=normalize(text).replace(/[.!]+$/,'').replace(/(?:,?\s+(?:porfa|por favor|gracias))$/,'');
 const parts=raw.split(/\s*(?:,|;|\by\b)\s*/);
 if(parts.length!==attributes.length || parts.some(part=>!part))return null;
 const selected=new Map<number,string>();
 for(const part of parts){
  const candidates=attributes.flatMap((attribute,index)=>attribute.options.flatMap(value=>{
   const option=normalize(value),label=normalize(attribute.attributeName);
   return [option,`con ${option}`,`en ${option}`,`${label}: ${option}`].includes(part)?[{index,value}]:[];
  }));
  if(candidates.length!==1 || selected.has(candidates[0].index))return null;
  selected.set(candidates[0].index,candidates[0].value);
 }
 return attributes.map((attribute,index)=>({attributeName:attribute.attributeName,attributeValue:selected.get(index)!}));
}
