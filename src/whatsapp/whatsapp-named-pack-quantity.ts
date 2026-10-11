const counts:Record<string,number>={un:1,una:1,uno:1,dos:2,duo:2,duos:2,tres:3,trio:3,trios:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
function normalized(text:string):string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\b(un|una|uno|dos|duos?|tres|trios?|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/g,w=>String(counts[w]))
    .replace(/[^a-z0-9\s]/g,' ').replace(/\bde\b/g,' ').replace(/\s+/g,' ').trim();
}
/** A count that is part of a catalog SKU name describes its contents, not copies of that SKU. */
export function namedPackOrderQuantity(text:string,productName:string):number|null {
  const name=normalized(productName);
  const pack=name.match(/^(\d{1,2})\s+(.+)$/);
  if(!pack || Number(pack[1])<2 || Number(pack[1])>10)return null;
  const source=normalized(text);
  const namePattern=name.split(' ').map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const match=new RegExp(`\\b${namePattern}\\b`).exec(source);
  if(!match)return null;
  const prefix=source.slice(0,match.index).trim();
  const copies=prefix.match(/(?:^|\s)(\d{1,2})\s*(?:(?:paquetes?|combos?|promociones?|unidades?|pedidos?)\s*)?$/);
  return copies ? Math.max(1,Math.min(30,Number(copies[1]))) : 1;
}
