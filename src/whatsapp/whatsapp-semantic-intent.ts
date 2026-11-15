export const SEMANTIC_ROLES = [
  'purchase', 'edit', 'remove', 'checkout', 'inquiry', 'conversation', 'cancel', 'finish', 'unclear',
] as const;
export type SemanticRole = typeof SEMANTIC_ROLES[number];
export type SemanticIntent = {
  segments: Array<{ text: string; role: SemanticRole; productIds?: number[] }>;
};

const canonical = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Account for the whole message, including negation and corrections. Never accept paraphrased evidence. */
export function parseSemanticIntent(value: unknown, source: string): SemanticIntent | null {
  const segments = (value as Partial<SemanticIntent> | null)?.segments;
  if (!Array.isArray(segments) || !segments.length || segments.length > 20) return null;
  const message = canonical(source);
  let cursor = 0;
  const result: SemanticIntent['segments'] = [];
  for (const segment of segments) {
    if (!segment || typeof segment.text !== 'string' || !segment.text.trim() ||
        !SEMANTIC_ROLES.includes(segment.role)) return null;
    if (segment.productIds !== undefined && (!Array.isArray(segment.productIds) || segment.productIds.length>20 ||
        new Set(segment.productIds).size!==segment.productIds.length || segment.productIds.some(id=>!Number.isSafeInteger(id) || id<1))) return null;
    const text = canonical(segment.text);
    const start = message.indexOf(text, cursor);
    const gap = message.slice(cursor, start);
    const additiveSeparator = cursor > 0 && /^[\s,.!?¿¡;:…–—-]*[ye][\s,.!?¿¡;:…–—-]*$/u.test(gap);
    if (start < 0 || !/^[\s,.!?¿¡;:…–—-]*$/u.test(gap) && !additiveSeparator) return null;
    cursor = start + text.length;
    result.push({ text: segment.text.trim(), role: segment.role,...(segment.productIds ? {productIds:segment.productIds} : {}) });
  }
  if (!/^[\s,.!?¿¡;:…–—-]*$/u.test(message.slice(cursor))) return null;
  return { segments: result };
}

const TOOL_ROLES: Record<string, readonly SemanticRole[]> = {
  offer_products: ['purchase','edit','inquiry','unclear'],
  search_menu: ['purchase','edit','inquiry','unclear'],
  resolve_multi_order: ['purchase','edit','unclear'],
  add_item: ['purchase'],
  update_item: ['edit'],
  replace_item: ['edit'],
  set_attribute: ['edit'],
  set_unit_attributes: ['edit'],
  remove_item: ['remove', 'edit'],
  set_notes: ['edit'],
  set_address: ['checkout'],
  set_order_type: ['checkout'],
  set_checkout_details: ['checkout'],
  clear_cart: ['cancel'],
};
export const semanticToolRequiresSource = (tool: string): boolean => Object.hasOwn(TOOL_ROLES, tool);
const READ_TOOLS = new Set(['get_cart', 'order_status', 'delivery_time', 'request_human']);

/** Source evidence grants a bounded capability to one tool. Read-only intent cannot become a mutation. */
export function authorizeSemanticTool(intent: SemanticIntent | undefined, tool: string, sourceText: unknown): boolean {
  if (!intent) return false;
  if (READ_TOOLS.has(tool)) return true;
  if (intent.segments.some(segment => segment.role === 'unclear') && !['search_menu','resolve_multi_order','offer_products'].includes(tool)) return false;
  const roles = TOOL_ROLES[tool];
  return !!roles && typeof sourceText === 'string' && intent.segments.some(segment =>
    roles.includes(segment.role) && canonical(segment.text) === canonical(sourceText));
}

export const SEMANTIC_INTENT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'interpret_message',
    strict: true,
    description: 'Interpreta la intención COMPLETA del mensaje con el contexto reciente antes de buscar productos o proponer cambios. Copia fragmentos literales en orden. Todos los términos del mensaje deben quedar cubiertos. Una consulta, una aclaración o una cortesía no autoriza compras.',
    parameters: {
      type: 'object',
      properties: { segments: { type: 'array', minItems: 1, maxItems: 20, items: {
        type: 'object', properties: { text: { type: 'string' }, role: { type: 'string', enum: [...SEMANTIC_ROLES] }, productIds:{type:'array',items:{type:'integer'},maxItems:20} },
        required: ['text', 'role','productIds'], additionalProperties: false,
      } } },
      required: ['segments'], additionalProperties: false,
    },
  },
};

export const SEMANTIC_CHECKOUT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'set_checkout_details',
    description: 'Propone datos explícitos del cliente para el pedido activo. Conserva separados nombre, teléfono, dirección y método de pago. Omite lo no indicado. Nunca confirma una orden.',
    parameters: { type: 'object', properties: {
      sourceText: { type: 'string' }, customerName: { type: 'string' }, contactPhone: { type: 'string' },
      paymentMethod: { type: 'string', description: 'Nombre del método mencionado por el cliente.' },
    }, required: ['sourceText'], additionalProperties: false },
  },
};

export const SEMANTIC_INTENT_PROMPT = `
INTERPRETACIÓN COMPLETA OBLIGATORIA
Primero ejecuta interpret_message. Lee todo el mensaje, el carrito, el paso abierto y el historial antes de decidir.
Los segmentos son citas literales ordenadas EXCLUSIVAMENTE del último mensaje de usuario. El historial solo resuelve referencias y nunca aporta segmentos ni operaciones nuevas. Cada aparición del texto actual se cubre una sola vez, aunque el historial contenga el mismo texto. Conserva todos los términos, cantidades, negaciones y preferencias. No resumas ni inventes citas. Mantén la negación, las preguntas, las cantidades y el alcance unidos a la petición a la que afectan. No separes una negación o una pregunta de su producto para convertirlo en compra.
purchase autoriza una compra nueva. edit modifica algo existente. remove retira algo. checkout proporciona datos de entrega, nombre, teléfono o pago. inquiry consulta sin comprar. conversation es saludo, cortesía, introducción o explicación sin una operación sobre el pedido. cancel cancela. finish termina de agregar y continúa los datos del pedido. unclear requiere aclaración.
Agrupa en un mismo segmento las oraciones que expresan una sola corrección y su reformulación o explicación. El segmento puede abarcar varias oraciones completas. Divide cuando haya operaciones independientes, consultas o compras adicionales. No conviertas cada oración de una única sustitución en una modificación duplicada que exija volver a actuar sobre productos ya reemplazados.
Una consulta que menciona un producto no pide agregarlo. Una reformulación puede describir cómo debe quedar el pedido existente. Interpreta las referencias usando el contexto y conserva cantidades y líneas ajenas.
Si falta identificar la intención o el alcance de un cambio, usa unclear y pregunta UNA cosa sin modificar el carrito.
En productIds identifica los SKUs a los que se refiere cada segmento, usando carrito e historial. Usa [] cuando no haya referencia resuelta. Resuelve referencias a un plato existente antes de pedir de nuevo su nombre. Con un único producto en el carrito, una referencia a ese plato usa ese SKU salvo que el mensaje nombre otro. La respuesta de interpret_message devuelve los datos reales de las referencias identificadas. La interpretación queda fija durante el turno. search_menu puede resolver un producto de destino adicional dentro del mismo segmento. Conserva el origen y usa replace_item cuando cambia el SKU. Cada tool de cambio exige sourceText idéntico a un segmento que autoriza esa operación. Interpreta las cláusulas mezcladas por separado y conserva la intención completa. Usa los datos ya devueltos por las herramientas y agrupa operaciones independientes cuando estén resueltas. replace_item sustituye UNA línea de origen. Si el cliente corrige varios productos separados para que quede un único plato compuesto, sustituye una línea y retira mediante remove_item todas las demás líneas de origen que ya no deben quedar. Comprueba el carrito resultante antes de dar por terminada la corrección.
Las búsquedas también exigen sourceText de un segmento de compra, cambio, consulta o duda. Una introducción conversacional no puede convertirse en una búsqueda de producto. Usa search_menu para verificar datos. Un resultado sin coincidencias significa que falta resolver la búsqueda. Solo afirma que un plato está ausente cuando identificaste claramente qué producto gastronómico pidió el cliente. Las palabras conversacionales nunca son productos ausentes.
Un producto conocido pendiente de elegir sabor u otra opción mantiene intención purchase. Usa add_item para que el backend abra las opciones. Si falta elegir SKU, usa offer_products. Nunca publiques opciones numeradas sin esa tool. Si solo preguntas o aclaras, no anuncies cambios. El backend muestra el carrito de los cambios aceptados y solicita los datos pendientes. No confirmes órdenes ni inventes pagos verificados.
`;

export const SEMANTIC_CHOICE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'offer_products',
    description: 'Ofrece una elección persistida entre SKUs reales sin agregarlos. El backend muestra una única lista y conserva su cantidad y opciones. Usa esta tool cuando falta elegir producto; nunca inventes listas numeradas en la respuesta.',
    parameters: {type:'object',properties:{
      sourceText:{type:'string'},productIds:{type:'array',minItems:1,maxItems:8,items:{type:'integer'}},
      quantity:{type:'integer',minimum:1,maximum:10},note:{type:'string'},
      replaceCartLineIndex:{type:'integer',minimum:0,description:'Solo para reemplazar una línea existente completa; exige intención edit y conserva sus unidades.'},
      attributes:{type:'array',items:{type:'object',properties:{attributeName:{type:'string'},attributeValue:{type:'string'}},required:['attributeName','attributeValue'],additionalProperties:false}},
    },required:['sourceText','productIds'],additionalProperties:false},
  },
};

export function semanticPlanIsComplete(intent: SemanticIntent, fulfilled: readonly string[]): boolean {
  const completed = new Set(fulfilled.map(canonical));
  return intent.segments.every(segment => !['purchase','edit','remove','checkout','cancel'].includes(segment.role) ||
    completed.has(canonical(segment.text)));
}

/** A tool must address the products identified during complete-message interpretation. */
export function semanticToolTargetsAuthorized(intent: SemanticIntent, tool: string, args: Record<string, unknown>,
  lookupTargets?: Map<string, Set<number>>): boolean {
  const segment = intent.segments.find(segment => typeof args.sourceText === 'string' && canonical(segment.text) === canonical(args.sourceText));
  if (tool === 'set_notes') return !!segment && !segment.productIds?.length;
  if (!['add_item','update_item','remove_item','replace_item','set_attribute','set_unit_attributes'].includes(tool)) return true;
  const ids = segment?.productIds || [];
  const discovered = segment && lookupTargets?.get(canonical(segment.text));
  if (!Number.isSafeInteger(args.productId) ||
      !(ids.includes(args.productId as number) || tool === 'add_item' && discovered?.has(args.productId as number))) return false;
  return tool !== 'replace_item' || Number.isSafeInteger(args.newProductId) &&
    (ids.includes(args.newProductId as number) || !!discovered?.has(args.newProductId as number));
}

export function semanticTargetsComplete(intent: SemanticIntent, fulfilled: Map<string, Set<number>>): boolean {
  return intent.segments.every(segment => !['purchase','edit','remove'].includes(segment.role) ||
    (segment.productIds || []).every(id => fulfilled.get(canonical(segment.text))?.has(id)));
}
