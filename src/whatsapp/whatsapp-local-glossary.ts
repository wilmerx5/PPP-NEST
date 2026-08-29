/**
 * Glosario local PPP: typos, aliases y frases del restaurante.
 * Se aplica ANTES del matching para que la IA y el catálogo vean el mismo texto.
 *
 * Fuente: chats reales humano↔cliente (corpus 2026-08) + bugs de prod.
 */

/** Reescrituras de frase (orden importa: más específicas primero). */
const PHRASE_REWRITES: Array<{ re: RegExp; to: string }> = [
  // Saludos rotos / typos de arranque
  { re: /\bbuena\s+snoches\b/gi, to: 'buenas noches' },
  { re: /\bpar\s+pagarte\b/gi, to: 'para pagarte' },
  { re: /\bpap[aá]\s+a\s+la\s+francesa\b/gi, to: 'papa a la francesa' },
  // Tamaño sopas
  { re: /\b(ajiaco|menudencias?)\s+(chico|chica|chiquito|chiquita|pequenito|pequenita)\b/gi, to: '$1 pequeña' },
  { re: /\bsopas?\s+(chicas?|chiquitas?|pequenitas?)\b/gi, to: 'sopa pequeña' },
  { re: /\bsopa\s+de\s+ajiaco\s+(chica|chiquita|pequenita)\b/gi, to: 'sopa de ajiaco pequeña' },
  { re: /\bsopa\s+ajiaco\s+(pequena|pequeña|chica)\b/gi, to: 'sopa de ajiaco pequeña' },
  // Pollo / mixto
  { re: /\bmedio\s+de\s+pollo\b/gi, to: 'medio pollo' },
  { re: /\bun\s+medio\s+(?:de\s+)?pollo\b/gi, to: 'medio pollo' },
  { re: /\bpollo\s+a\s+la\s+broaster\b/gi, to: 'pollo broaster' },
  { re: /\bpollo\s+ala\s+broaster\b/gi, to: 'pollo broaster' },
  { re: /\bmedio\s+broaster\s+medio\s+frito\b/gi, to: 'pollo mixto medio broaster medio frito' },
  { re: /\bmedio\s+frito\s+medio\s+broaster\b/gi, to: 'pollo mixto medio frito medio broaster' },
  { re: /\bcombo\s+(?:de\s+)?pollo\s+mixto\b/gi, to: 'combo pollo mixto' },
  { re: /\bsobre\s+barriga\b/gi, to: 'sobrebarriga' },
  { re: /\bsobrebarriga\s+a\s+la\s+placha\b/gi, to: 'sobrebarriga a la plancha' },
  { re: /\ba\s+la\s+placha\b/gi, to: 'a la plancha' },
  { re: /\barroz\s+chuno\b/gi, to: 'arroz chino' },
  { re: /\barroz\s+chino\s+el\s+que\s+viene\s+con\s+medio\s+pollo\b/gi, to: 'arroz chino con medio pollo' },
  { re: /\barroz\s+chino\s+en\s+combo\b/gi, to: 'arroz chino combo' },
  { re: /\barroz\s+paisa\s+sencillo\b/gi, to: 'arroz paisa solo' },
  { re: /\ben\s+comboo\b/gi, to: 'en combo' },
  // Add-on tardío (corpus): "alcanzo a encargarte una ensalada"
  { re: /\b(?:me\s+)?alcanzo\s+a\s+(?:encargarte|pedir|pedirte|agregar)\s+/gi, to: 'quiero ' },
  { re: /\b(?:me\s+)?alcanzas?\s+(?:a\s+)?(?:encargar|pedir)?\s*/gi, to: 'quiero ' },
  // Add-ons con typo "plata" = plátano (no “plata” de dinero suelta)
  { re: /\b(?:adicionar|adicion|adici[oó]n)\s+(?:un\s+|de\s+)?plata\b/gi, to: 'adicionar un plátano' },
  { re: /\bun\s+plata\b/gi, to: 'un plátano' },
  { re: /\bel\s+plata\b/gi, to: 'el plátano' },
  // Guarnición → forma canónica para notas
  { re: /\bno\s+me\s+(?:pongan?|pongas)\s+/gi, to: 'no quiero ' },
  { re: /\bsin\s+arepitas?\b/gi, to: 'sin arepa' },
  { re: /\bmas\s+papitas?\b/gi, to: 'más papas' },
  { re: /\bmás\s+papitas?\b/gi, to: 'más papas' },
  { re: /\ben\s+vez\s+de\s+yuca\s+(?:mas|más)\s+papa\b/gi, to: 'sin yuca más papa' },
  { re: /\bsin\s+salsas?,?\s+(?:mas|más)\s+miel\b/gi, to: 'sin salsas más miel' },
];

const WORD_REWRITES: Array<{ re: RegExp; to: string | ((m: string) => string) }> = [
  { re: /\bquieor\b/gi, to: 'quiero' },
  { re: /\bquiiero\b/gi, to: 'quiero' },
  { re: /\bqiero\b/gi, to: 'quiero' },
  { re: /\bkiero\b/gi, to: 'quiero' },
  { re: /\bquero\b/gi, to: 'quiero' },
  { re: /\buenas\b/gi, to: 'buenas' },
  { re: /\btmb\b/gi, to: 'también' },
  // Pegado sin espacios: "unpollofrito" / "unpollo"
  { re: /\bunpollofrito\b/gi, to: 'un pollo frito' },
  { re: /\bunpollobroaster\b/gi, to: 'un pollo broaster' },
  { re: /\bunpollo\b/gi, to: 'un pollo' },
  { re: /\bped[ií]\b/gi, to: 'pedi' },
  { re: /\bejeuctivo\b/gi, to: 'ejecutivo' },
  { re: /\bejecutvo\b/gi, to: 'ejecutivo' },
  { re: /\b(?:roaster|broster|brouster)\b/gi, to: 'broaster' },
  { re: /\bplacha\b/gi, to: 'plancha' },
  { re: /\bgiger\b/gi, to: 'ginger' },
  { re: /\bginguer\b/gi, to: 'ginger' },
  { re: /\bmarcuya\b/gi, to: 'maracuya' },
  { re: /\bmaracuya\b/gi, to: 'maracuya' },
  { re: /\bmenundencias?\b/gi, to: 'menudencias' },
  { re: /\bmenudencia\b/gi, to: 'menudencias' },
  {
    re: /\bchurr+ascos?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'churrascos' : 'churrasco'),
  },
  {
    re: /\bmojarr+as?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'mojarras' : 'mojarra'),
  },
  {
    re: /\blimonad+as?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'limonadas' : 'limonada'),
  },
  {
    re: /\bhamburegsas?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
  },
  {
    re: /\bhamburgesas?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
  },
  {
    re: /\bhamburgues+as?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
  },
  {
    re: /\bhamburguersas?\b/gi,
    to: (m) => (/s$/i.test(m) ? 'hamburguesas' : 'hamburguesa'),
  },
  { re: /\bajico\b/gi, to: 'ajiaco' },
  { re: /\bajiacos\b/gi, to: 'ajiaco' },
  { re: /\bmondongos\b/gi, to: 'mondongo' },
  { re: /\blitrso\b/gi, to: 'litros' },
  { re: /\b(?:un\s+)?litro\s+y\s+medi[oa]\b/gi, to: '1.5 litros' },
  { re: /\bmedia?\s+de\s+litro\b/gi, to: '0.5 litros' },
  { re: /\bcoca\s*cola\s*(cero|zero)\b/gi, to: 'coca cola zero' },
  { re: /\bpar\s+ale\b/gi, to: 'para el' },
  { re: /\bpar\s+a\s+la\b/gi, to: 'para la' },
  { re: /\bpar\s+a\s+el\b/gi, to: 'para el' },
  { re: /\bpar\s+el\b/gi, to: 'para el' },
  { re: /\bpar\s+la\b/gi, to: 'para la' },
  { re: /\bpala\s+el\b/gi, to: 'para el' },
  { re: /\bpala\s+la\b/gi, to: 'para la' },
  { re: /\bpala\s+los\b/gi, to: 'para los' },
  { re: /\bpala\s+las\b/gi, to: 'para las' },
];

/**
 * Normaliza typos y aliases del local.
 * Idempotente en lo razonable; no cambia nombres de platos válidos.
 */
export function applyLocalGlossary(text: string): string {
  let out = (text || '').trim();
  if (!out) return out;

  for (const { re, to } of PHRASE_REWRITES) {
    out = out.replace(re, to);
  }
  for (const { re, to } of WORD_REWRITES) {
    out = typeof to === 'function' ? out.replace(re, to) : out.replace(re, to);
  }

  return out.replace(/\s+/g, ' ').trim();
}

/** Bloque de glosario para el prompt de la IA (memoria del local). */
export function buildLocalGlossaryPromptBlock(): string {
  return `
GLOSARIO DEL LOCAL (interpreta así; no inventes otros significados):
- "Sopa pequeña" / "ajiaco pequeño/chico" = SKU "Sopa pequeña" + atributo Ajiaco (NO "Sopa De Ajiaco", que es la grande).
- "Mondongo pequeña" = SKU "Sopa De Mondongo Pequeña".
- "Sopa De Ajiaco" / "ajiaco" sin "pequeña" = la grande.
- "Duo / doble / pack de X" solo si el cliente dice duo/doble/pack; si dice "una hamburguesa" → Hamburguesa unitaria.
- "Pollo mixto" / "medio broaster medio frito" = combo/variante mixta, no dos pollos sueltos.
- "Arroz chino" tiene presentaciones (caja+francesa / medio pollo / costillas / combo gaseosa): pregunta cuál si no queda claro.
- Preferencias "no quiero arepas, más papas, sin yuca, sin ensalada, sin cilantro, más miel" con carrito = NOTA del plato, no productos nuevos.
- Typos frecuentes: broster→broaster, giger→ginger, placha→plancha, marcuya→maracuyá, menundencia→menudencias, plata(+add)→plátano, churrrasco→churrasco, par ale→para el.
- Zona típica de domicilio: Castilla (y variantes), Nuevo Sol, Tabaku, Altavista, Techo, Tintal — si el cliente solo nombra el conjunto/torre/apto, es dirección.
`.trim();
}
