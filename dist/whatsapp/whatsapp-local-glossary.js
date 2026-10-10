"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLocalGlossary = applyLocalGlossary;
const whatsapp_message_classify_1 = require("./whatsapp-message-classify");
const PHRASE_REWRITES = [
    { re: /\bbuena\s+snoches\b/gi, to: 'buenas noches' },
    { re: /\bquieres\s+in\b/gi, to: 'quiero un' },
    { re: /\bquiero\s+in\b/gi, to: 'quiero un' },
    { re: /\bpar\s+pagarte\b/gi, to: 'para pagarte' },
    { re: /\bpap[aá]\s+a\s+la\s+francesa\b/gi, to: 'papa a la francesa' },
    { re: /\bporci[oó]n(?:es)?\s+(?:de\s+)?papas?\s+fritas?\b/gi, to: 'porcion de papa francesa' },
    { re: /\bunas?\s+papas?\s+fritas?\b/gi, to: 'papa francesa' },
    { re: /\bpapas?\s+fritas?\b/gi, to: 'papa francesa' },
    { re: /\ba\s*c[oó]mo\b/gi, to: 'a cuanto' },
    { re: /\bdirecion\b/gi, to: 'dirección' },
    { re: /\b(ajiaco|menudencias?)\s+(chico|chica|chiquito|chiquita|pequenito|pequenita)\b/gi, to: '$1 pequeña' },
    { re: /\bsopas?\s+(chicas?|chiquitas?|pequenitas?)\b/gi, to: 'sopa pequeña' },
    { re: /\bsopa\s+de\s+ajiaco\s+(chica|chiquita|pequenita)\b/gi, to: 'sopa de ajiaco pequeña' },
    { re: /\bsopa\s+ajiaco\s+(pequena|pequeña|chica)\b/gi, to: 'sopa de ajiaco pequeña' },
    { re: /\bunas?\s+peque[nñ]as?\b/gi, to: 'una pequeña' },
    { re: /\bunas?\s+chicas?\b/gi, to: 'una pequeña' },
    { re: /\bmedio\s+de\s+pollo\b/gi, to: 'medio pollo' },
    { re: /\bun\s+medio\s+(?:de\s+)?pollo\b/gi, to: 'medio pollo' },
    { re: /\bcombo\s+(?:de\s+)?pollo\s+y\s+medio\b/gi, to: '__COMBO_POLLO_Y_MEDIO__' },
    {
        re: /(?<!\d\s)(?:\b(?:un|el|unos?)\s+)?\bpollos?\s+y\s+medio(?:\s+(frit[oa]|broaster|broster|asad[oa]|mixto))?\b/gi,
        to: (_match, style) => {
            const raw = (style || '').toLowerCase();
            const word = raw === 'broster' ? 'broaster' : raw === 'frita' ? 'frito' : raw === 'asada' ? 'asado' : raw;
            const suffix = word ? ` ${word}` : '';
            return `1 pollo${suffix} y medio pollo${suffix}`;
        },
    },
    { re: /__COMBO_POLLO_Y_MEDIO__/gi, to: 'combo de pollo y medio' },
    { re: /\bporfavor\b/gi, to: 'por favor' },
    {
        re: /\b(?:y\s+)?(medio|media|cuarto|cuarta|entero|entera)\s+que\s+vale\b/gi,
        to: '$1 pollo que vale',
    },
    {
        re: /\b(?:y\s+)?(medio|media|cuarto|cuarta)\s+(?:a\s+)?(?:como|cuanto)\b/gi,
        to: '$1 pollo a cuanto',
    },
    { re: /\bpollo\s+a\s+la\s+broaster\b/gi, to: 'pollo broaster' },
    { re: /\bpollo\s+ala\s+broaster\b/gi, to: 'pollo broaster' },
    { re: /\balmuerzo\s+ejecutivo\b/gi, to: 'ejecutivo' },
    { re: /\b1\s+almuerzo\s+ejecutivo\b/gi, to: '1 ejecutivo' },
    { re: /\bmen[uú]\s+ejecutivo\b/gi, to: 'ejecutivo' },
    { re: /\b1\s+men[uú]\s+ejecutivo\b/gi, to: '1 ejecutivo' },
    { re: /\bun\s+men[uú]\s+ejecutivo\b/gi, to: 'un ejecutivo' },
    { re: /\bmedio\s+broaster\s+medio\s+frito\b/gi, to: 'pollo mixto medio broaster medio frito' },
    { re: /\bmedio\s+broster\s+medio\s+frito\b/gi, to: 'pollo mixto medio broaster medio frito' },
    { re: /\bmedio\s+frito\s+medio\s+broaster\b/gi, to: 'pollo mixto medio frito medio broaster' },
    { re: /\bmedio\s+frito\s+medio\s+broster\b/gi, to: 'pollo mixto medio frito medio broaster' },
    { re: /\bcombo\s+(?:de\s+)?pollo\s+mixto\b/gi, to: 'combo pollo mixto' },
    { re: /\bcombo\s+(?:de\s+)?pollo\s+mixt\b/gi, to: 'combo pollo mixto' },
    { re: /\bcombo\s+(?:de\s+)?pollo\s+misto\b/gi, to: 'combo pollo mixto' },
    { re: /\bsobre\s+barriga\b/gi, to: 'sobrebarriga' },
    { re: /\bsopitas?\b/gi, to: 'sopa' },
    { re: /\by\s+una\s+menos\s+de\s+(?:una?\s+)?/gi, to: 'y una ' },
    { re: /\buna\s+menos\s+de\s+(?:una?\s+)?/gi, to: 'una ' },
    { re: /\bsobrebarriga\s+a\s+la\s+placha\b/gi, to: 'sobrebarriga a la plancha' },
    { re: /\ba\s+la\s+placha\b/gi, to: 'a la plancha' },
    { re: /\bpechugas?\s+asad[oa]s?\b/gi, to: 'pechuga a la plancha' },
    { re: /\bsobrebarrigas?\s+(?:asad[oa]s?|a\s+la\s+plancha)\b/gi, to: 'sobrebarriga asada' },
    { re: /\bcarne\s+asad[oa]\b/gi, to: 'carne a la plancha' },
    { re: /\barroz\s+chuno\b/gi, to: 'arroz chino' },
    { re: /\barroz\s+chino\s+el\s+que\s+viene\s+con\s+medio\s+pollo\b/gi, to: 'arroz chino con medio pollo' },
    { re: /\barroz\s+chino\s+en\s+combo\b/gi, to: 'arroz chino combo' },
    { re: /\bcombo\s+de\s+arroz\s+chino\b/gi, to: 'arroz chino combo' },
    { re: /\bun\s+combo\s+de\s+arroz\s+chino\b/gi, to: 'un arroz chino combo' },
    { re: /\barroz\s+paisa\s+sencillo\b/gi, to: 'arroz paisa solo' },
    { re: /\ben\s+comboo\b/gi, to: 'en combo' },
    {
        re: /\b(\d{1,2})\s+(colombiana|manzana|pepsi|coca\s*cola|gaseosa|sprite|postobon|uva)\s+(\d)\s*[.,]\s*(\d)\b/gi,
        to: '$1 $2 $3.$4 litros',
    },
    {
        re: /\b(colombiana|manzana|pepsi|coca\s*cola|gaseosa|sprite|postobon|uva)\s+(\d)\s*[.,]\s*(\d)\b/gi,
        to: '$1 $2.$3 litros',
    },
    { re: /\bpara\s+pedirte\s+(?:por\s+fa|porfa|por\s+favor)\s+/gi, to: 'quiero ' },
    { re: /\bpara\s+pedir\s+(?:por\s+fa|porfa|por\s+favor)\s+/gi, to: 'quiero ' },
    { re: /\b(?:me\s+)?alcanzo\s+a\s+(?:encargarte|pedir|pedirte|agregar)\s+/gi, to: 'quiero ' },
    { re: /\b(?:me\s+)?alcanzas?\s+a\s+(?:encargar|pedir|pedirte|agregar)\s+/gi, to: 'quiero ' },
    { re: /\b(?:me\s+)?alcanzas?\s+(?:encargar|pedir|pedirte|agregar)\s+/gi, to: 'quiero ' },
    { re: /\b(?:adicionar|adicion|adici[oó]n)\s+(?:un\s+|de\s+)?plata\b/gi, to: 'adicionar un plátano' },
    { re: /\bun\s+plata\b/gi, to: 'un plátano' },
    { re: /\bel\s+plata\b/gi, to: 'el plátano' },
    { re: /\bno\s+me\s+(?:pongan?|pongas)\s+/gi, to: 'no quiero ' },
    { re: /\bsin\s+arepitas?\b/gi, to: 'sin arepa' },
    { re: /\bmas\s+papitas?\b/gi, to: 'más papas' },
    { re: /\bmás\s+papitas?\b/gi, to: 'más papas' },
    { re: /\ben\s+vez\s+de\s+yuca\s+(?:mas|más)\s+papa\b/gi, to: 'sin yuca más papa' },
    { re: /\bsin\s+salsas?,?\s+(?:mas|más)\s+miel\b/gi, to: 'sin salsas más miel' },
    { re: /\bsin\s+ensladas?\s+(?:mas|más)\s+papas?\b/gi, to: 'sin ensalada más papa' },
    { re: /\bsin\s+ensalada\s+(?:mas|más)\s+papas?\b/gi, to: 'sin ensalada más papa' },
    {
        re: /\bsin\s+ensalada,?\s+a\s+cambio(?:\s+de)?\s+(?:la\s+|el\s+)?papa(?:s)?(?:\s+salada)?\b/gi,
        to: 'sin ensalada papa salada',
    },
    {
        re: /\bsin\s+ensalada,?\s+a\s+cambio(?:\s+de)?\s+(?:la\s+|el\s+)?yuca(?:\s+frita)?\b/gi,
        to: 'sin ensalada yuca frita',
    },
    {
        re: /\ba\s+cambio(?:\s+de)?\s+(?:la\s+|el\s+)?papa(?:s)?(?:\s+salada)?\b/gi,
        to: 'papa salada',
    },
    {
        re: /\ba\s+cambio(?:\s+de)?\s+(?:la\s+|el\s+)?yuca(?:\s+frita)?\b/gi,
        to: 'yuca frita',
    },
    { re: /\bcambiar\s+(?:la\s+)?ensalada\s+por\s+papa\s+salada\b/gi, to: 'sin ensalada papa salada' },
    { re: /\bcambiar\s+(?:la\s+)?ensalada\s+por\s+yuca\s+frita\b/gi, to: 'sin ensalada yuca frita' },
    { re: /\bcambia(?:me|r)?\s+(?:la\s+)?ensalada\s+por\s+papa\s+salada\b/gi, to: 'sin ensalada papa salada' },
    { re: /\bcambia(?:me|r)?\s+(?:la\s+)?ensalada\s+por\s+yuca\s+frita\b/gi, to: 'sin ensalada yuca frita' },
    { re: /\b(?:me\s+)?(?:la\s+)?cambia(?:s|mos)?\s+(?:la\s+)?ensalada\s+por\s+yuca\s+frita\b/gi, to: 'sin ensalada yuca frita' },
    { re: /\b(?:me\s+)?(?:la\s+)?cambia(?:s|mos)?\s+(?:la\s+)?ensalada\s+por\s+papa\s+salada\b/gi, to: 'sin ensalada papa salada' },
    { re: /\bensalada\s+(?:tambi[eé]n\s+)?(?:me\s+la\s+)?cambia(?:s)?\s+por\s+yuca\s+frita\b/gi, to: 'sin ensalada yuca frita' },
    { re: /\bensalada\s+por\s+papa\s+salada\b/gi, to: 'sin ensalada papa salada' },
    { re: /\bensalada\s+por\s+yuca\s+frita\b/gi, to: 'sin ensalada yuca frita' },
    { re: /\b(?:una?\s+)?botella(?:s)?\s+de\s+agua\b/gi, to: 'agua 600ml' },
    { re: /\bagua\s+en\s+botella\b/gi, to: 'agua 600ml' },
];
const WORD_REWRITES = [
    { re: /\bensladas?\b/gi, to: (m) => (/s$/i.test(m) ? 'ensaladas' : 'ensalada') },
    { re: /\bcr[eé]dit\b/gi, to: 'crédito' },
    { re: /\bquieor\b/gi, to: 'quiero' },
    { re: /\bquiiero\b/gi, to: 'quiero' },
    { re: /\bqiero\b/gi, to: 'quiero' },
    { re: /\bkiero\b/gi, to: 'quiero' },
    { re: /\bquero\b/gi, to: 'quiero' },
    { re: /\buenas\b/gi, to: 'buenas' },
    { re: /\btmb\b/gi, to: 'también' },
    {
        re: /\b(caurtos?|cuatos?|cuarttos?|cuertos?|kwartos?|cuartto)\b/gi,
        to: (m) => (/s$/i.test(m) ? 'cuartos' : 'cuarto'),
    },
    {
        re: /\b(meidos?|nedios?|meidios?|meddio)\b/gi,
        to: (m) => (/s$/i.test(m) ? 'medios' : 'medio'),
    },
    {
        re: /\b(mixt|misto|mixtto|mixtos)\b/gi,
        to: (m) => (/s$/i.test(m) ? 'mixtos' : 'mixto'),
    },
    { re: /\bunpollofrito\b/gi, to: 'un pollo frito' },
    { re: /\bpollofrito\b/gi, to: 'pollo frito' },
    { re: /\bunpollobroaster\b/gi, to: 'un pollo broaster' },
    { re: /\bunpollo\b/gi, to: 'un pollo' },
    { re: /\b(pillos|pilos|pojlos|polllos)\b/gi, to: 'pollos' },
    { re: /\b(pillo|pilo|pojlo)\b/gi, to: 'pollo' },
    { re: /\bjuegos\b/gi, to: 'jugos' },
    { re: /\bjuego\b/gi, to: 'jugo' },
    { re: /\bt[\s\-]*(\d{1,2})\s*(?:apto|apt|ap)\.?\s*(\d{2,4})\b/gi, to: 'torre $1 apto $2' },
    { re: /\bt[\s\-]*(\d{1,2})\b/gi, to: 'torre $1' },
    { re: /\b(\d)\s*apto\.?\s*(\d{2,4})\b/gi, to: '$1 apto $2' },
    { re: /\btorre\s*(\d+)\s*apto\.?\s*(\d{2,4})\b/gi, to: 'torre $1 apto $2' },
    { re: /\btorre(\d+)\b/gi, to: 'torre $1' },
    { re: /\bapt\.?\s+(\d{2,4})\b/gi, to: 'apto $1' },
    { re: /\bapto\.?\s*(\d{2,4})\b/gi, to: 'apto $1' },
    { re: /\bun\s+como\s+(?:de\s+)?pollo\b/gi, to: 'un combo de pollo' },
    { re: /\bcomo\s+de\s+pollo\b/gi, to: 'combo de pollo' },
    { re: /\bme\s+da\s+un\s+como\b/gi, to: 'me da un combo' },
    { re: /\btiens\b/gi, to: 'tienes' },
    { re: /\bteneis\b/gi, to: 'tienen' },
    { re: /\bped[ií]\b/gi, to: 'pedi' },
    { re: /\bejeuctivo\b/gi, to: 'ejecutivo' },
    { re: /\bejecutvo\b/gi, to: 'ejecutivo' },
    { re: /\b(?:roaster|broster|brouster)\b/gi, to: 'broaster' },
    { re: /\bplacha\b/gi, to: 'plancha' },
    { re: /\brecogo\b/gi, to: 'recojo' },
    { re: /\brecoger\s+en\s+el\s+local\b/gi, to: 'recojo en el local' },
    { re: /\brecojo\s+en\s+el\s+local\b/gi, to: 'recojo en el local' },
    { re: /\bpaso\s+por\s+(?:ella|el|él|la)\s+(?:al\s+)?local\b/gi, to: 'paso por el local' },
    { re: /\byo\s+paso\s+por\s+(?:ella|el|él|la)\s+(?:al\s+)?local\b/gi, to: 'yo paso por el local' },
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
    { re: /\bq\s+(cuestan|cuesta|valen|vale|precio|hay|tienen)\b/gi, to: 'que $1' },
    { re: /\bdomicikios?\b/gi, to: 'domicilio' },
    { re: /\bdomiclios?\b/gi, to: 'domicilio' },
    { re: /\bdomisilios?\b/gi, to: 'domicilio' },
    { re: /\bdmicilios?\b/gi, to: 'domicilio' },
];
function applyLocalGlossary(text) {
    let out = (text || '').trim();
    if (!out)
        return out;
    for (const { re, to } of PHRASE_REWRITES) {
        out = out.replace(re, to);
    }
    for (const { re, to } of WORD_REWRITES) {
        out = typeof to === 'function' ? out.replace(re, to) : out.replace(re, to);
    }
    out = (0, whatsapp_message_classify_1.fixFuzzyDomicilioTypos)(out);
    return out
        .replace(/[^\S\n]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .trim();
}
//# sourceMappingURL=whatsapp-local-glossary.js.map