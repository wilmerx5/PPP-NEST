/** Resolve a bounded side phrase against this dish's description, never the whole menu.
 * A single typo in a later word is accepted only with an exact first-word anchor
 * and one distinct description phrase. Single-word fuzzy guesses are excluded. */
export function resolveDescribedSidePhrase(phrase: string, description: string): string | null {
 const words=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-zñ]+/g)||[];
 const said=words(phrase), have=words(description);
 if(!said.length||said.length>3)return null;
 const windows=have.flatMap((_,i)=>i+said.length<=have.length?[have.slice(i,i+said.length)]:[]);
 if(windows.some(row=>row.every((word,i)=>word===said[i])))return said.join(' ');
 if(said.length<2)return null;
 const oneEdit=(a:string,b:string)=>{
  if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+(a.length-i)+(b.length-j)===1;
 };
 const matches=new Set(windows.filter(row=>row[0]===said[0]&&row.filter((word,i)=>word!==said[i]).length===1&&row.every((word,i)=>word===said[i]||oneEdit(word,said[i]))).map(row=>row.join(' ')));
 return matches.size===1?[...matches][0]:null;
}
