import {isUsableWhatsappCustomerName} from './whatsapp-session-intents';

/** Bounded multiline form: named purchase, recipient, street, references, phone.
 * Reject additional free text rather than silently discarding an order clause. */
export function checkoutEnvelope(source:string,isProductLine:(line:string)=>boolean,isPhone:(line:string)=>boolean,paymentChoice?:(line:string)=>string|null):{orderText:string;customerName:string;phone:string;address:string;paymentMethod?:string}|null {
 const lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(lines.length<5 || lines.length>12)return null;
 const phones=lines.filter(line=>/^[+\d ()-]+$/.test(line) && isPhone(line));
 if(phones.length!==1)return null;
 const payments=lines.map(line=>({line,id:paymentChoice?.(line)})).filter(item=>item.id);
 if(payments.length>1)return null;
 const body=lines.filter(line=>line!==phones[0] && !payments.some(item=>item.line===line));
 if(!isProductLine(body[0]))return null;
 let end=1;while(end<body.length&&isProductLine(body[end]))end++;
 const name=(body[end]||'').replace(/^(?:a\s+nombre(?:\s+de)?|nombre\s*:)\s*/i,'').trim();
 if(!/^[\p{L}]+(?:[ .'-]+[\p{L}]+){1,4}$/u.test(name) || !isUsableWhatsappCustomerName(name) || /^(?:torres?|conjunto|residencial|edificio|barrio|calle|carrera|diagonal|avenida)\b/i.test(name))return null;
 const addressLines=body.slice(end+1);
 const street=addressLines.find(line=>/^(?:calle|cll?|carrera|cra|diagonal|dg|transversal|avenida)\b.*\d/i.test(line));
 if(!street || !addressLines.every(line=>line===street || /^(?:torres?|conjunto|residencial|edificio|barrio|apto|apartamento|bloque|interior|casa)\b/i.test(line)))return null;
 return {orderText:body.slice(0,end).join('\n'),customerName:name,phone:phones[0].replace(/\D/g,''),address:[street,...addressLines.filter(line=>line!==street)].join(', '),...(payments[0]?.id?{paymentMethod:payments[0].id}: {})};
}
