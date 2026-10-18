import { editDistance } from './whatsapp-message-classify';

const STEMS=['dorad','cocinad','cocid','tostad','delgad','grues','gord','bonit','crud','sec'];
const ADJECTIVE=`(?:(?:${STEMS.join('|')})(?:it)?[oa]s?|calientes?|fri[oa]s?|crocantes?|crujientes?)`;
const FORMS=STEMS.flatMap(stem=>['o','a','os','as','ito','ita','itos','itas'].map(ending=>stem+ending));
const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/** A bounded preparation/presentation phrase, never a free-form trailing item.
 * Spelling tolerance only classifies an adjective; the stored note stays literal.
 */
export function kitchenDescriptionNote(source:string):string|null {
 const raw=source.trim().replace(/\s+(?:por favor|porfa|gracias)[.!]*$/i,'').replace(/[.!]+$/,'').trim();
 if(!raw || raw.length>200 || /[?¿;\d]/.test(raw))return null;
 let text=normalize(raw).replace(/[,!.]+/g,' ').replace(/\s+/g,' ').trim();
 text=text.replace(/\b[a-z]{5,}\b/g,word=>{
  if(new RegExp(`^${ADJECTIVE}$`).test(word))return word;
  const matches=FORMS.filter(form=>Math.abs(form.length-word.length)<=1&&editDistance(form,word)<=1);
  return matches.length ? matches[0] : word;
 });
 const qualified=`(?:(?:bien|muy|no tan|no muy|un poco) )?${ADJECTIVE}`;
 const relative=`que (?:no )?(?:(?:me|nos) )?(?:esten?|vengan?|sean?|salgan?|(?:vayan? a )?(?:salir|venir|llegar)) (?:(?:tan|muy|bien|demasiado|un poco) )?${ADJECTIVE}`;
 const clause=`(?:${relative}|${qualified})`;
 return new RegExp(`^${clause}(?: (?:(?:y|pero) )?${clause})*$`).test(text)?raw:null;
}

/** Only strong handling language can split an unbound dish request. Bare
 * adjectives require an exact catalogue anchor in interpretProductNote. */
export function splitKitchenDescription(source:string):{productText:string;note:string}|null {
 for(const match of source.matchAll(/\b(?:bien|muy|que)\b/giu)){
  if(!match.index)continue;
  const note=kitchenDescriptionNote(source.slice(match.index));if(!note || !/\bque\b/i.test(note))continue;
  const productText=source.slice(0,match.index).replace(/[\s,.]+$/,'').replace(/\s+(?:pero|y|con)$/i,'').trim();
  if(productText.length>=3)return {productText,note};
 }
 return null;
}
