/** Detect an explicit unit scope, not a count belonging to a drink/side.
 * Conversion capability is decided by the caller, independently of parsing. */
export function variantUnitScope(source:string, parseQuantity:(word:string)=>number):{quantity:number;statedTotal?:number}|null {
 const text=source.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
 const count='(?:\\d{1,4}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
 const prefix=text.match(new RegExp(`\\b(?:solo|solamente)\\s+(${count})(?:\\s+de\\s+(?:los|las)\\s+(${count}))?\\s+en\\s+combo\\b`,'i')) ||
  text.match(new RegExp(`\\b(${count})\\s+de\\s+(?:los|las)\\s+(${count})\\s+en\\s+combo\\b`,'i'));
 const suffix=text.match(new RegExp(`(?:\\bpero\\b|,)\\s*(?:solo|solamente)\\s+(${count})(?:\\s+de\\s+(?:los|las)\\s+(${count}))?(?:\\s+unidad(?:es)?)?(?:\\s+por\\s+favor)?[.!]*$`,'i'));
 const match=prefix || suffix;if(!match)return null;
 const parse=(word:string)=>/^\d+$/.test(word)?Number(word):parseQuantity(word.toLowerCase());
 const quantity=parse(match[1]);const total=match[2]?parse(match[2]):undefined;
 return Number.isInteger(quantity) && (total===undefined || Number.isInteger(total)) ? {quantity,...(total!==undefined?{statedTotal:total}:{})} : null;
}
