/** Keep internal access identifiers for the driver, out of the map query.
 * Only labelled numeric units are detached; street numbers and place names stay. */
export function splitDeliveryAddressParts(source:string):{base:string;details:string} {
 const raw=(source || '').trim();
 const unit=/\s+(?=(?:entrada|torre|bloque|apartamento|apto|interior|int|casa|piso|local|oficina)\.?\s*(?:#\s*)?\d)/i.exec(raw);
 if(!unit || /^(?:entrada|torre|bloque|apartamento|apto|interior|int|casa|piso|local|oficina)\.?\s*(?:#\s*)?\d/i.test(raw))return {base:raw,details:''};
 const base=raw.slice(0,unit.index).replace(/[,;\s]+$/,'').replace(/^a\s+/i,'').trim();
 return base ? {base,details:raw.slice(unit.index).trim()} : {base:raw,details:''};
}
