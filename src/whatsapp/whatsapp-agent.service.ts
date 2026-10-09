import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import {
  WhatsappCatalogService,
  type WhatsappCatalogProduct,
} from './whatsapp-catalog.service';
import type { AiOrderAction } from './types/whatsapp-session.types';
import { applyOpenAiChatCompat } from './whatsapp-openai-compat';
import { resolveConceptBrowseForAgent } from './whatsapp-menu-concepts';
import type { MenuConceptGroup } from './whatsapp-menu-concepts';
import { looksLikeAddressOnlyMessage } from './whatsapp-intent';
import { looksLikeKitchenSendRequest, parseEachOfQuantity, parseQtyDishCorrection } from './whatsapp-session-intents';

export type AgentV1TurnInput = {
  userMessage: string;
  sessionSummary: string;
  recentMessages: string[];
  businessRulesBlock: string;
  brandName: string;
  products: WhatsappCatalogProduct[];
  menuUrl?: string | null;
  humanPhone?: string | null;
  menuConceptGroups?: MenuConceptGroup[];
  cart?: Array<{
    productId: number;
    name: string;
    attributes?: { attributeName: string; attributeValue: string }[];
  }>;
};

export type AgentV1TurnResult = {
  reply: string;
  actions: AiOrderAction;
  /** Producto que necesita attrs: el orquestador abre pendingAttribute */
  needsAttributeProductId?: number;
  /** El cliente pregunta por un pedido ya hecho. Nest consulta el estado real. */
  lookupPlacedOrder?: { orderNumber?: number };
  /** Pregunta cuánto tarda un domicilio en general. Nest usa el tiempo de la config. */
  lookupDeliveryTime?: boolean;
  toolCalls: string[];
  error?: string;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_menu',
      description:
        'Busca platos en el menú autorizado por nombre, código, estilo (frito, broaster…) o concepto (carne, pescado, sopas). En pedidos con varios platos, llámala una vez por plato. Úsala ANTES de add_item.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto de búsqueda del cliente' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'resolve_multi_order',
      description:
        'Resuelve un mensaje con VARIOS platos contra el menú (ej. "arroz chino con medio pollo y sopa de ajiaco"). ' +
        'Devuelve productIds listos para add_item y dudas (ambiguous). Preferir esta tool en multi-pedido; no inventes platos.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Mensaje completo del cliente con varios platos',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_item',
      description:
        'Agrega un producto al carrito por id del menú. Pasa opciones explícitas en attributes; las omitidas toman la primera opción del catálogo, sin preguntar.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'number' },
          quantity: { type: 'number', minimum: 1, maximum: 10 },
          note: { type: 'string', description: 'Nota de cocina (ej. pollo broaster)' },
          attributes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                attributeName: { type: 'string' },
                attributeValue: { type: 'string' },
              },
              required: ['attributeName', 'attributeValue'],
            },
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'remove_item',
      description: 'Quita un producto del carrito por productId.',
      parameters: {
        type: 'object',
        properties: { productId: { type: 'number' } },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_attribute',
      description:
        'Cambia una opción YA elegida en un producto del carrito (bebida, pollo, arepa, presa, sabor). ' +
        'attributeValue tiene que ser una opción de ESE producto. No agrega un plato nuevo.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'number' },
          attributeName: { type: 'string' },
          attributeValue: { type: 'string' },
        },
        required: ['productId', 'attributeName', 'attributeValue'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_address',
      description:
        'Guarda dirección de domicilio (calle/carrera/conjunto/barrio). NUNCA uses para platos, quejas, saludos ni frases que no sean un lugar.',
      parameters: {
        type: 'object',
        properties: { address: { type: 'string' } },
        required: ['address'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_order_type',
      description: 'delivery = domicilio, pickup = recojo en local.',
      parameters: {
        type: 'object',
        properties: {
          orderType: { type: 'string', enum: ['delivery', 'pickup'] },
        },
        required: ['orderType'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_notes',
      description: 'Notas del pedido / preferencias de cocina.',
      parameters: {
        type: 'object',
        properties: { notes: { type: 'string' } },
        required: ['notes'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_cart',
      description: 'Vacía el carrito si el cliente lo pide explícitamente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'request_human',
      description: 'Deriva a atención humana cuando no puedes resolver.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'order_status',
      description:
        'La intención es saber cómo va un pedido que el cliente YA hizo. ' +
        'No es el carrito que se está armando ni un plato nuevo. Nest responde con el estado real. ' +
        'orderNumber solo si el cliente dijo el número de orden.',
      parameters: {
        type: 'object',
        properties: {
          orderNumber: { type: 'number', description: 'Número de orden del día, si lo dijo' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delivery_time',
      description:
        'La intención es saber cuánto tarda un domicilio en general. ' +
        'No es un pedido que ya hizo ni un plato. Nest responde con el tiempo configurado. No inventes minutos.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

/**
 * Agent V1: LLM con tool-calling.
 * El orquestador aplica ActionGuard + carrito; este servicio solo propone.
 */
@Injectable()
export class WhatsappAgentService {
  private readonly logger = new Logger(WhatsappAgentService.name);
  private readonly maxIterations = 6;

  constructor(
    private readonly settingsService: WhatsappSettingsService,
    private readonly catalogService: WhatsappCatalogService,
  ) {}

  async runTurn(input: AgentV1TurnInput): Promise<AgentV1TurnResult> {
    const cfg = await this.settingsService.getEffectiveConfig();
    const phone = (input.humanPhone || cfg.localContext?.publicPhone || '3118866823').replace(
      /\D/g,
      '',
    );
    if (!cfg.openaiApiKey) {
      return {
        reply: `El asistente aún no está configurado. Contáctanos al *${phone || '3118866823'}*.`,
        actions: {},
        toolCalls: [],
        error: 'no_openai_key',
      };
    }

    // Referencias deícticas y distributivas sin un único referente claro:
    // jamás crear productos por adivinar "ese" o "de cada una".
    const shortNorm = input.userMessage.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim();
    if (/\b(?:\d+|un[ao]?|dos|tres|cuatro|cinco)\s+de\s+cada\s+un[ao]\b/.test(shortNorm) ||
      /^(?:(?:dame|regalame|quiero|ponme)\s+)?(?:un[ao]?\s+)?(?:ese|esa|esos|esas)\s+(?:que\s+(?:dijiste|me\s+dijiste)|de\s+(?:antes|arriba))\b/.test(shortNorm)) {
      return {
        reply: 'Claro, ¿cuáles platos quieres exactamente y cuántos de cada uno?',
        actions: {},
        toolCalls: [],
      };
    }

    // Los mensajes informativos no deben crear lineas en el carrito.
    const broadQuery = input.userMessage.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const budget = broadQuery.match(/\b(?:menos de|por debajo de|hasta)\s*(\d{1,3})(?:[.,]?000|\s*mil)\b/);
    if (budget && /\b(almorzar|almuerzo|plato|comida|menu|tienen|recomienda)\b/.test(broadQuery)) {
      const limit = Number(budget[1]) * 1000;
      const choices = input.products.filter((p) => p.availableNow !== false &&
        p.price < limit &&
        !/\b(gaseosa|jugo|bebida|porcion|agua|coca cola|cerveza|mr tea|sopa)\b/i.test(p.name)
      ).slice(0, 4);
      return {
        reply: choices.length
          ? 'Por ese presupuesto tenemos: ' +
            choices.map((p) => p.name + ' (' + p.price + ' pesos)').join(', ') +
            '. Cual prefieres?'
          : 'No tengo un plato principal confirmado para ese presupuesto. Te muestro otras opciones?',
        actions: {},
        toolCalls: [],
      };
    }
    if (/\b(hacen|hace|tienen|hay|manejan|cubren|cobertura)\b/.test(broadQuery) &&
      /\b(domicilios?|entregas?|envios?)\b/.test(broadQuery)) {
      return {
        reply: 'Si manejamos pedidos a domicilio. Dime la direccion completa para confirmar cobertura y tarifa.',
        actions: {},
        toolCalls: [],
      };
    }

    // Observacion de cocina con carrito existente.
    if (input.cart?.length && looksLikeKitchenSendRequest(input.userMessage)) {
      const note = input.userMessage.replace(/^(?:y\s+)/i, '').trim();
      return {
        reply: 'Listo, dejo esa observación para cocina. ¿Algo más?',
        actions: { setCustomerNotes: note },
        toolCalls: [],
      };
    }

    const userNormalized = input.userMessage.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim();
    const normalizedProductName = (value: string) => value.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const arrozChinoOptions = input.products.filter((p) =>
      p.availableNow !== false && normalizedProductName(p.name).includes('arroz chino'));

    // Preguntar qué presentación quiere; no decidir por él ni perder la
    // referencia de "arroz chino" cuando aún no menciona otra variante.
    if (/\barroz chino\s*$/.test(userNormalized) && arrozChinoOptions.length >= 2) {
      const names = arrozChinoOptions.slice(0, 5).map((p) => p.name);
      return {
        reply: 'Tenemos varias presentaciones de arroz chino: ' +
          names.join(', ') + '. ¿Cuál quieres?',
        actions: {},
        toolCalls: [],
      };
    }
    // Si el catálogo ya tiene el producto con broaster, responder la consulta
    // sin crear una línea en el carrito (aún no es una confirmación de compra).
    if (/\barroz chino\b/.test(userNormalized) && /\bbroaster\b/.test(userNormalized) &&
        /\b(podria|puede|puedo|podemos|se puede)\b/.test(userNormalized)) {
      const variant = arrozChinoOptions.find((p) =>
        (p.attributes || []).some((attr) =>
          attr.attributeName.toLowerCase() === 'pollo' &&
          attr.options.some((option) => option.toLowerCase() === 'broaster')));
      if (variant) {
        return {
          reply: 'Sí, el ' + variant.name +
            ' permite escoger pollo Broaster. ¿Quieres esa presentación?',
          actions: {},
          toolCalls: [],
        };
      }
    }

    // Un pedido con sustitución explícita sigue siendo un pedido: la nota
    // no debe hacer desaparecer el plato base. Si hay dos presentaciones de
    // pechuga, pedir la variante, nunca elegir plancha/gratinada por defecto.
    const normalizedOrder = input.userMessage.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      /\barroz con pollo\b/.test(normalizedOrder) &&
      /\bpechuga\b/.test(normalizedOrder) &&
      /\bsin ensalada\b/.test(normalizedOrder) &&
      /\byuca frita\b/.test(normalizedOrder)
    ) {
      const normalizedName = (name: string) => name.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').trim();
      const arroz = input.products.filter((p) =>
        p.availableNow !== false && normalizedName(p.name) === 'arroz con pollo');
      const pechugas = input.products.filter((p) =>
        p.availableNow !== false &&
        /\bpechuga\b/.test(normalizedName(p.name)) &&
        !/\b(ejecutivo|combo|arroz)\b/.test(normalizedName(p.name)));
      if (
        arroz.length === 1 && pechugas.length > 1 &&
        !/\b(plancha|gratinada|asada)\b/.test(normalizedOrder)
      ) {
        return {
          reply: 'Anoté el arroz con pollo sin ensalada y la solicitud de cambiarla por yuca frita (sujeto a confirmación del local). ¿La pechuga la quieres a la plancha o gratinada?',
          actions: {
            addItems: [{
              productId: arroz[0].id,
              quantity: 1,
              note: 'Sin ensalada. Solicita cambiarla por yuca frita (confirmar disponibilidad).',
            }],
            setCustomerNotes: 'Para la pechuga también solicita cambiar ensalada por yuca frita (confirmar disponibilidad).',
          },
          toolCalls: [],
        };
      }
    }

    // Un mensaje solo con domicilio no puede reinterpretar platos que
    // aparezcan en la memoria de la conversación; nunca llamar add_item.
    const rawAddressText = input.userMessage.trim();
    const cleanAddress = rawAddressText.replace(/^(?:es\s+para|para)\s+/i, '').trim();
    if (
      looksLikeAddressOnlyMessage(rawAddressText) ||
      looksLikeAddressOnlyMessage(cleanAddress) ||
      /^(?:es\s+para|para)\s+(?:casa\s+\d+|calle|carrera|cra|dg|diagonal|conjunto|torre)\b/i.test(rawAddressText)
    ) {
      return {
        reply: 'Listo, anoté esa dirección. ¿Qué más necesitas?',
        actions: { setAddress: cleanAddress, setOrderType: 'delivery' },
        toolCalls: [],
      };
    }

    // Corrección de sopas explícita: resolver por variante única y reemplazar,
    // no sumar al carrito anterior. Si faltan SKUs/variantes, decidir por LLM
    // con el flujo normal y nunca inventar IDs.
    const correctedDishes = parseQtyDishCorrection(input.userMessage);
    if (correctedDishes?.length && /\bsopas?\b/i.test(input.userMessage)) {
      const normalize = (value: string) =>
        value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const soupProducts = input.products.filter((p) =>
        p.availableNow !== false &&
        (/sopas?/i.test(p.categoryName || '') || /\bsopa\b/i.test(p.name)) &&
        !(p.attributes?.length),
      );
      const selected = correctedDishes.map(({ qty, dish }) => {
        const candidates = soupProducts.filter((p) =>
          normalize(p.name).includes(normalize(dish)) &&
          normalize(dish).length >= 4,
        );
        return candidates.length === 1 ? { productId: candidates[0].id, quantity: qty } : null;
      });
      if (selected.every((p) => p !== null)) {
        const preserveText = input.userMessage.match(/;\s*(?:deja|conserva)\s+(.+)$/i)?.[1];
        const preserved = preserveText ? (input.cart || []).filter(line => {
          const product = input.products.find(p => p.id === line.productId);
          return product && this.catalogService.productNameFitsUtterance(product, preserveText);
        }) : [];
        if (preserveText && preserved.length !== 1) {
          return { reply: '¿Cuál producto del pedido quieres conservar?', actions: {}, toolCalls: [] };
        }
        return {
          reply: 'Entendido, corrijo el pedido con esas cantidades. ¿Algo más?',
          actions: {
            ...(preserved.length
              ? { removeProductIds: (input.cart || []).filter(line => line.productId !== preserved[0].productId).map(line => line.productId) }
              : { clearCart: true }),
            addItems: selected as Array<{ productId: number; quantity: number }>,
          },
          toolCalls: [],
        };
      }
    }

    // "2 de cada una" no identifica SKU por sí mismo; una lista previa puede
    // contener presentaciones solapadas (ej. sopa pequeña y sopas de sabor).
    // Detener tool-calling antes de que el LLM invente productos.
    if (parseEachOfQuantity(input.userMessage)) {
      return {
        reply: 'Claro, ¿me confirmas de cuáles platos exactamente y cuántas unidades de cada uno? Así no te agrego algo que no pediste.',
        actions: {},
        toolCalls: [],
      };
    }

    const byId = new Map(input.products.map((p) => [p.id, p]));
    const actions: AiOrderAction = {};
    const toolCalls: string[] = [];
    let needsAttributeProductId: number | undefined;
    let lookupPlacedOrder: { orderNumber?: number } | undefined;
    let lookupDeliveryTime = false;

    const system = `${cfg.systemPrompt}

Eres el agente de pedidos por WhatsApp de *${input.brandName}*.
NO inventes productos ni precios. Usa tools para buscar y modificar el carrito.
Reglas:
- Siempre search_menu antes de add_item si no tienes el productId.
- Pedido con VARIOS platos ("3 mojarras, 2 costillas y 3 pollos fritos" / "arroz chino con medio pollo y ajiaco"):
  Preferir resolve_multi_order con el mensaje completo; luego add_item por cada confident.
  Si no hay multi claro: search_menu por cada plato (puedes llamar varias tools en paralelo) y add_item.
  Reply muy corto o vacío: el sistema muestra el carrito y pregunta ¿algo más?
  No respondas solo "¿qué se te antoja?" si el cliente ya listó platos.
  Tras add_item: NO pidas nombre, dirección ni pago.
- Si search_menu trae mode="semantic_filter": filtra candidates por significado (ej. carne ≠ mojarra ≠ pollo) y ofrece 2–4. No inventes platos fuera de candidates.
- Si mode="category_clean" o concept: ofrece 2–4 en tono natural. NUNCA digas "no encontré X en el menú".
- Si mode="cooking_style_browse": el cliente pidió una *preparación* (sudado, frito, asado…). Lista cada result (nombre y precio): pollo, pescado, porciones y bandeja si están. No te quedes en dos porciones del mismo plato. Si no hay ese estilo, dilo y menciona availableStyles. PROHIBIDO dump de todas las categorías.
- El menú que devuelve search_menu es la única fuente de verdad. Tú analizas, comparas y respondes. No inventes platos, precios ni ingredientes.
- En cada mensaje, primero entiende la intención, también si Nest está pidiendo nombre, dirección o pago. Puede ser: preguntar si hay algo, pedir, corregir, saber el precio, saber qué incluye, cambiar lo que ya dijo, domicilio, pago, cómo va un pedido que ya hizo, cuánto tarda un domicilio, o seguir con lo que está abierto. Un typo no cambia la intención. Luego actúa solo con lo que la carta y las tools permiten.
- Si la intención es el estado de un pedido que ya hizo, llama order_status. No es el carrito abierto. No agregues platos y no reenvíes el carrito. Nest dice el estado real.
- Si la intención es cuánto tarda un domicilio en general, llama delivery_time. No inventes minutos.
- "¿Tienes X?" / "¿qué tienes de X?" / "¿cómo es X?" vale para cualquier cosa. Lista lo que search_menu sí trae (nombre, precio, qué incluye y preparaciones si las hay) y pregunta cuál quiere. NO add_item. add_item solo si está pidiendo ese plato.
- "¿Tienes algo de X?" (también "tines", "hay algo de", "te pregunté que si tienes"): pregunta si hay X. Si search_menu no lo trae, di "No tenemos productos de X". X es el producto, sin "algo de", sin "tienes" y sin repetir la frase. No reenvíes el carrito.
- Pedido de varios platos: la intención es armar ese pedido. Busca cada plato. Di solo el que no está. El resto lo agregas y lo confirmas en una frase, con nombre y precio. No tires la frase entera como si nada existiera.
- Pedido directo ("un churrasco", "quiero una limonada"): add_item en ese mismo turno. No preguntes "¿lo agrego?".
- También aplica a varios platos y ejecutivos. No pidas elegir atributos omitidos: add_item rellena los predeterminados. Respeta los explícitos.
- "sí", "si por favor", "dale", "ok" y "listo" confirman solo cuando el mensaje no dice nada más. No son el nombre del cliente.
- Si la frase trae otra intención (quitar, cambiar, agregar, corregir, preguntar), aunque empiece con "listo" o "ok" y aunque tenga typos: haz esa intención con el carrito y la carta. No confirmes el pedido y no pidas la dirección.
- Corrección en lenguaje normal: es cambiar lo que está abierto o en el carrito. Mira la LISTA ABIERTA o la ELECCIÓN PENDIENTE y la carta. Corrige con set_attribute, remove_item o add_item. No digas que no entendiste. No uses request_human por una corrección.
- "vi la milanesa en el menú" / "sí está en la carta": search_menu de esas palabras, con el typo. Si está, súmala al pedido que ya está abierto y confirma el resto. Si no está, discúlpate, di que no la tenemos, manda el link del menú y sigue con lo que sí quedó. No abras otro plato.
- "no quiero el broaster, quiero el frito", "con ají", "paso a recoger", "hasta dónde llevan", "están abiertos", "no hay promo del día": responde esa intención. Tarifas y horario salen de las reglas, no los inventes. No hay promoción del día: dilo en una frase y pide el plato. El mixto es medio broaster y medio frito.
- "para un domicilio" / "para pedirte un domicilio" sin plato y con carrito vacío: no pidas el nombre. Pregunta qué se le antoja. El nombre va cuando ya hay pedido.
- "cambiame X por Y" es un cambio de algo que el plato ya trae, no un plato que se llama así. search_menu con el mensaje completo. Si mode="swap", add_item solo del host y pon la nota que trae la tool. No digas que no manejamos la frase entera. No agregues lo que pidieron quitar ni otro producto por el cambio.
- No agregues un plato distinto del que nombraron. Si dijeron bandeja paisa y ese nombre no es el del result, no lo agregues: di que no lo tenemos.
- Si mode="hosted_drink": la bebida es opción del plato (combo). add_item de ese productId con attributes. NO agregues la gaseosa suelta.
- Si mode="drink_order": es una bebida de la carta. add_item con ese productId y attributes. No digas que no la tenemos.
- Si mode="menu_drinks": esa bebida no está. Di que no la tenemos (las palabras del cliente) y lista drinks: nombre, precio y sabores. NO add_item. No inventes marcas.
- Si mode="style_alternatives": ese estilo no está en el plato. Di que no lo tenemos (las palabras del cliente) y lista results (nombre y precio). NO add_item.
- Si mode="not_on_menu": uncoveredWords no están en la carta. NO agregues el parecido. Di que no lo manejamos con las palabras del cliente. Si results trae platos, menciónalos (nombre y precio) como lo que sí hay.
- Si mode="category_browse" trae missing: primero di que no tenemos ese plato (el valor de missing) y después lista results como alternativas. Si no trae missing, lista cada result (nombre, precio y descripción). No agregues uno solo.
- Si mode="availability" o un product_match: lista cada result (nombre, precio y descripción). Si el cliente nombró algo que ese plato no trae (nombre, descripción o atributos), dilo primero: no lo ofrecemos en el momento, y results es la alternativa. No lo confirmes como si fuera el plato pedido.
- Si mode="composition": qué lleva sale de description y attributes. Si preguntan si incluye algo y otro result de esa familia sí lo trae, di que este no y ese sí. NO add_item.
- Si search_menu no trae el plato: di con calidez "Por ahora no manejamos X" o "Ese no lo tenemos en la carta" y ofrece el link del menú.
  PROHIBIDO "No veo", "No encontré", "No aparece" (suena seco).
- "Menú" / "carta" / "pásame el menú" SIN calificativo → link de la carta (NO add_item).
- "Menú ejecutivo|especial|de la casa|del día|…" o "bandeja con…" → plato del catálogo si search_menu lo trae; NUNCA lo confundas con el link ni con el pollo suelto.
- Si el nombre más específico ya incluye al otro ("combo de pollo frito" incluye "1 pollo frito"), add_item solo del más específico. No agregues los dos.
- Si hay una lista abierta y piden una de esas opciones en una frase ("quiero un cuarto… y cambiar la yuca por papa"), add_item de ESA opción. La presa o el sabor que nombren van en attributes. Lo que piden cambiar y el plato ya trae (descripción o atributo) va en la nota. No digas que no entendiste y no mandes el menú.
- Si en el pago dicen que agregaste un plato de más, remove_item de ese plato y deja el que sí pidieron. No vuelvas a preguntar el pago sin quitarlo.
- Si hay varias presentaciones del mismo plato (combo, costillas, medio, caja, frito/broaster), menciónalas todas. No te quedes en dos.
- "pollo y medio" = 1 pollo entero + 1/2 pollo (elige estilos con el cliente).
- "qué hay de comida rápida" / "qué bandejas hay" → lista lo que search_menu trae en esa categoría. Si piden un plato que no está y search_menu trae missing, dilo y ofrece esa categoría como alternativas. NO resumas con pollos ni agregues una sola hamburguesa.
- "qué jugos/sopas/gaseosas tienes" es otra cosa de la carta. NO ofrezcas cambiar la bebida (ni otro atributo) ya elegida. Manzana/Uva del combo son gaseosas, no jugos, salvo que exista un producto *Jugo* en search_menu.
- Si el cliente pide otra opción de un producto que YA está en el carrito (bebida, pollo, arepa, presa, sabor), llama set_attribute con productId, attributeName y attributeValue de la sesión. Un typo ("roaster") es la opción real más cercana (Broaster) si está en esa lista. NO add_item, NO set_notes y NO digas que no lo manejamos.
- Si search_menu devuelve mode="cart_attribute", llama set_attribute con ese candidate.
- set_address solo con un lugar (calle, carrera, barrio, conjunto). Si responde ok:false, contesta al cliente en una frase y no hables de domicilio.
- Si piden un plato que existe en frito y en broaster y no dijeron cuál, el sistema lista las dos. No asumas frito.
- Solo set_notes si el plato NO tiene atributo de estilo ni otro SKU con ese estilo.
- La confirmación final la hace el cliente escribiendo *confirmar* (no inventes pagos).
- Si no entiendes: una pregunta corta o request_human.
- Español colombiano o neutro (tú/te). PROHIBIDO voseo argentino (vos, tenés, querés, respondé, mirá).
- Mensajes CORTOS (1–3 frases). No listes attrs 1/2/3: el sistema pone la primera opción; el cliente puede cambiar después.

${input.businessRulesBlock}

Sesión (carrito y estado — fuente de verdad):
${input.sessionSummary}

Menú: usa search_menu. Link: ${(input.menuUrl || '').trim() || 'menú del local'}
Contacto humano: *${phone || '3118866823'}*
`;

    const history = this.toChatMessages(input.recentMessages).slice(-10);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: input.userMessage },
    ];

    const model = cfg.openaiModel || 'gpt-4o-mini';

    try {
      for (let i = 0; i < this.maxIterations; i++) {
        const body = applyOpenAiChatCompat(
          {
            model,
            messages,
            tools: AGENT_TOOLS,
            tool_choice: 'auto',
          },
          {
            model,
            maxOutputTokens: 900,
            temperature: Math.min(0.4, cfg.aiTemperature ?? 0.2),
          },
        );

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.text();
          this.logger.error(`AgentV1 OpenAI ${res.status}: ${err.slice(0, 300)}`);
          return {
            reply: `Tuve un problema técnico. Contáctanos al *${phone || '3118866823'}*.`,
            actions,
            toolCalls,
            error: `openai_${res.status}`,
          };
        }

        const data = (await res.json()) as {
          choices?: {
            message?: ChatMessage;
            finish_reason?: string;
          }[];
        };
        const msg = data.choices?.[0]?.message;
        if (!msg) {
          return {
            reply: 'No pude procesar tu mensaje. ¿Me lo repites con el plato o código?',
            actions,
            toolCalls,
            error: 'empty_message',
          };
        }

        messages.push({
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });

        const calls = msg.tool_calls || [];
        if (!calls.length) {
          const reply = (msg.content || '').trim().slice(0, 3500);
          // Sin tools ni texto → el orquestador puede caer a reglas (multi-pedido)
          return {
            reply,
            actions,
            toolCalls,
            needsAttributeProductId,
            lookupPlacedOrder,
            lookupDeliveryTime,
            error: reply ? undefined : 'empty_reply',
          };
        }

        for (const call of calls) {
          const name = call.function?.name || '';
          toolCalls.push(name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>;
          } catch {
            args = {};
          }
          const toolResult = this.executeTool(name, args, {
            products: input.products,
            byId,
            actions,
            userMessage: input.userMessage,
            cart: input.cart,
            menuConceptGroups: input.menuConceptGroups,
            setNeedsAttr: (id) => {
              needsAttributeProductId = id;
            },
            setLookupOrder: (orderNumber?: number) => {
              lookupPlacedOrder = { orderNumber };
            },
            setLookupDeliveryTime: () => {
              lookupDeliveryTime = true;
            },
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: toolResult,
          });
        }
      }

      return {
        reply:
          'Estoy armando tu pedido. ¿Me confirmas el plato (nombre o código) o escribes *menú*?',
        actions,
        toolCalls,
        needsAttributeProductId,
        lookupPlacedOrder,
        lookupDeliveryTime,
        error: 'max_iterations',
      };
    } catch (err) {
      this.logger.error(`AgentV1 failed: ${err}`);
      return {
        reply: `No pude procesar tu mensaje. Contáctanos al *${phone || '3118866823'}*.`,
        actions,
        toolCalls,
        error: 'exception',
      };
    }
  }

  private executeTool(
    name: string,
    args: Record<string, unknown>,
    ctx: {
      products: WhatsappCatalogProduct[];
      byId: Map<number, WhatsappCatalogProduct>;
      actions: AiOrderAction;
      userMessage?: string;
      cart?: AgentV1TurnInput['cart'];
      menuConceptGroups?: MenuConceptGroup[];
      setNeedsAttr: (id: number) => void;
      setLookupOrder?: (orderNumber?: number) => void;
      setLookupDeliveryTime?: () => void;
    },
  ): string {
    switch (name) {
      case 'search_menu': {
        const query = String(args.query || '').trim();
        if (!query) return JSON.stringify({ ok: false, error: 'query vacío' });

        const swapSource = ctx.userMessage || query;
        const swap = this.catalogService.swapIntent(swapSource);
        const queryNorm = query
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const queryIsThisSwap =
          !!this.catalogService.swapIntent(query) ||
          (queryNorm.split(/\s+/).length <= 8 &&
            /\b(combo|gaseosa|bebida|papas?|frito)\b/.test(queryNorm));
        if (swap && queryIsThisSwap) {
          const dish = this.catalogService.dishTextBeforeSwap(swapSource);
          const host = this.catalogService.mostSpecificNamedProduct(dish, ctx.products);
          const carries = !!host && this.catalogService.productCarriesMention(host, swap.removed);
          if (host && carries) {
            return JSON.stringify({
              ok: true,
              query,
              mode: 'swap',
              host: this.productCard(host),
              removed: swap.removed,
              note: this.catalogService.swapChangeNote(swap.removed, swap.added),
              hint:
                'El plato ya trae lo que quieren cambiar (atributo o descripción). ' +
                'add_item solo del host, con esa nota. ' +
                'NO agregues otro producto por el cambio. ' +
                'NO agregues lo que pidieron quitar. ' +
                'NO agregues un plato más corto: si dijo combo, no el pollo suelto.',
            });
          }
        }

        const hosted = this.catalogService.hostedMenuDrink(
          ctx.userMessage || query,
          ctx.products,
        );
        if (hosted && this.catalogService.drinkTextMatchesAttribute(hosted.product, query)) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'hosted_drink',
            product: this.productCard(hosted.product),
            attributes: hosted.attributes,
            hint:
              'Esa bebida es una opción del plato, no un producto suelto. ' +
              'add_item con ese productId y estos attributes. No agregues la gaseosa aparte.',
          });
        }

        const similars = this.catalogService.similarNamedProducts(query, ctx.products);
        if (similars.length) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'similar_offer',
            results: similars.map((p) => this.productCard(p)),
            hint:
              'El cliente no nombró ese plato: solo una palabra que aparece dentro del nombre. ' +
              'Di que no lo ofrecemos, con la palabra que él dijo, y lista results (nombre y precio) como alternativa. ' +
              'NO add_item.',
          });
        }

        const drinkOrder = this.catalogService.resolveStandaloneDrinkOrder(
          query,
          ctx.products,
        );
        if (drinkOrder) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'drink_order',
            product: this.productCard(drinkOrder.product),
            attributes: drinkOrder.attributes,
            hint:
              'Es una bebida que sí está en la carta. add_item con ese productId y estos attributes. ' +
              'No digas que no la manejamos.',
          });
        }
        if (this.catalogService.shouldOfferMenuDrinks(query, ctx.products)) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'menu_drinks',
            drinks: this.catalogService.menuDrinkProducts(ctx.products).slice(0, 8).map((p) =>
              this.productCard(p),
            ),
            hint:
              'Esa bebida no está en la carta. Di que no la tenemos, con las palabras del cliente, ' +
              'y lista drinks (nombre, precio y opciones). NO add_item. No inventes otras marcas.',
          });
        }

        const styleAlts = this.catalogService.missingStyleAlternatives(query, ctx.products);
        if (styleAlts?.length) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'style_alternatives',
            results: styleAlts.map((p) => this.productCard(p)),
            hint:
              'Ese estilo no está en el plato o la porción. Di que no lo tenemos, con las palabras del cliente, ' +
              'y lista results (nombre y precio). NO add_item. No inventes otro estilo.',
          });
        }

        const sizedSoup = this.catalogService.resolveSizedSoupProduct?.(query, ctx.products);
        const uncovered = sizedSoup
          ? this.catalogService.uncoveredWordsAnchoredByProduct(query, sizedSoup)
          : this.catalogService.uncoveredDishWords(query, ctx.products);
        if (sizedSoup && !uncovered.length) {
          return JSON.stringify({ ok: true, query, mode: 'product_match',
            results: [this.productCard(sizedSoup)],
            hint: 'Presentación de sopa identificada. Si la pide, add_item ahora; si pregunta, responde sin agregar.' });
        }
        if (uncovered.length) {
          const named = this.catalogService.listCartAttributeOptionsNamedInText(
            query,
            ctx.cart || [],
            ctx.products,
          );
          const namedInUser =
            named.length || !ctx.userMessage
              ? named
              : this.catalogService.listCartAttributeOptionsNamedInText(
                  ctx.userMessage,
                  ctx.cart || [],
                  ctx.products,
                );
          if (namedInUser.length) {
            return JSON.stringify({
              ok: true,
              query,
              mode: 'cart_attribute',
              candidates: namedInUser,
              hint:
                'El cliente nombró una opción que YA está en un producto del carrito. ' +
                'Llama set_attribute con productId, attributeName y attributeValue de candidates. ' +
                'No digas que no lo manejamos. No add_item. No set_address.',
            });
          }
          const closest = this.catalogService.productsAnchoringDish(query, ctx.products);
          return JSON.stringify({
            ok: true,
            query,
            mode: 'not_on_menu',
            uncoveredWords: uncovered,
            results: closest.map((p) => this.productCard(p)),
            hint:
              `El menú no cubre: ${uncovered.join(', ')}. NO add_item. ` +
              'Responde tú: esas palabras no las manejamos. ' +
              'Si results trae platos, son lo más cercano: menciónalos (nombre y precio) como lo que sí hay, sin decir que son el plato pedido.',
          });
        }

        const comesWith = this.catalogService.comesWithOffer(
          ctx.userMessage || query,
          ctx.products,
        );
        if (comesWith) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'comes_with',
            reply: comesWith.reply,
            hint:
              'Pregunta si un plato trae otra cosa. Responde con reply tal cual. ' +
              'NO add_item. No listes otra categoría.',
          });
        }

        if (
          this.catalogService.isCategoryBrowseQuestion(query) ||
          this.catalogService.isMenuExploreIntent(query, ctx.products)
        ) {
          const hit = this.catalogService.findCategoryBrowseHit(
            query,
            ctx.products,
            ctx.menuConceptGroups,
          );
          if (hit?.products.length) {
            return JSON.stringify({
              ok: true,
              query,
              mode: 'category_browse',
              category: hit.categoryName,
              missing: hit.askedButMissing || null,
              results: hit.products.slice(0, 12).map((p) => this.productCard(p)),
              hint: hit.askedButMissing
                ? `No tenemos "${hit.askedButMissing}". Dilo primero, con esas palabras. ` +
                  'Después lista results (nombre y precio) como alternativas. ' +
                  'NO add_item. No presentes la lista como si ese plato existiera.'
                : 'Pregunta qué hay en esa parte del menú. Lista estos platos (nombre y precio). NO add_item.',
            });
          }
        }

        const byCode = this.catalogService.extractCodeFromMessage(query);
        if (byCode != null) {
          const found = this.catalogService.findByCode(byCode, ctx.products);
          if (found) {
            return JSON.stringify({
              ok: true,
              results: [this.productCard(found)],
            });
          }
        }

        if (this.catalogService.isAvailabilityInquiry(query)) {
          const family = this.catalogService.findProductVariantFamily(query, ctx.products);
          const variants = family?.variants?.length
            ? family.variants
            : [];
          if (variants.length) {
            return JSON.stringify({
              ok: true,
              query,
              mode: 'availability',
              results: variants.slice(0, 12).map((p) => this.productCard(p)),
              hint:
                'Pregunta si lo tenemos. Lista TODOS los results, uno por uno: nombre, precio y descripción. ' +
                'No resumas en “el básico y otra versión”. La descripción dice qué incluye aunque el nombre no lo diga. NO add_item.',
            });
          }
        }

        const compositionAsk =
          this.catalogService.isProductDescriptionInquiry(query) ||
          this.catalogService.isProductDescriptionInquiry(ctx.userMessage || '');
        if (compositionAsk) {
          const family =
            this.catalogService.findProductVariantFamily(query, ctx.products) ||
            this.catalogService.findProductVariantFamily(ctx.userMessage || '', ctx.products);
          const focus = family
            ? this.catalogService.pickVariantFromFamilyText(query, family) ||
              this.catalogService.pickVariantFromFamilyText(ctx.userMessage || '', family)
            : this.catalogService.findProductEmbeddedInMessage(query, ctx.products);
          const variants = family?.variants?.length ? family.variants : focus ? [focus] : [];
          if (variants.length) {
            return JSON.stringify({
              ok: true,
              query,
              mode: 'composition',
              focusId: focus?.id ?? null,
              results: variants.slice(0, 12).map((p) => this.productCard(p)),
              hint:
                'Qué lleva se responde con description y attributes, no con el título. ' +
                'Si preguntan si incluye algo, mira TODOS los results: di si el plato (focusId) lo trae y, si otro de la familia sí lo trae en la descripción o en un atributo, menciónalo. NO add_item.',
            });
          }
        }

        // Menú nombrado (ejecutivo / especial / de la casa / bandeja…) ≠ pollo suelto ni link de carta
        const namedMenuHit = this.catalogService.resolveNamedMenuDishProduct(
          query,
          ctx.products,
        );
        if (namedMenuHit) {
          return JSON.stringify({
            ok: true,
            query,
            mode: 'product_match',
            results: [this.productCard(namedMenuHit)],
            hint:
              'Es un *plato del catálogo* tipo menú/envoltorio (ejecutivo, especial, de la casa, bandeja…), ' +
              'NO el link de la carta. Si lo pide, add_item AHORA con defaults para opciones omitidas; no preguntes por presa/sopa/bebida. No ofrezcas el pollo/sopa sueltos aparte.',
          });
        }

        // SKU concreto primero ("jugo en leche", "churrasco") antes del browse de concepto
        const scoredEarly = this.catalogService.searchByNameScored(query, ctx.products, 6);
        if (
          scoredEarly.length >= 1 &&
          this.catalogService.isStrongProductMatch(scoredEarly) &&
          scoredEarly[0].score >= 70
        ) {
          const embeddedEarly = this.catalogService.findProductEmbeddedInMessage(
            query,
            ctx.products,
          );
          const results = scoredEarly.map((x) => this.productCard(x.p));
          if (embeddedEarly && !results.some((r) => r.id === embeddedEarly.id)) {
            results.unshift(this.productCard(embeddedEarly));
          }
          return JSON.stringify({
            ok: true,
            query,
            mode: 'product_match',
            results: results.slice(0, 6),
            hint:
              'Hay coincidencia fuerte de producto. Si lo pide, add_item en este turno con defaults; no pidas otra confirmación. Si preguntan "¿tienen?", di que sí y ofrece agregarlo. ' +
              'No digas que no hay ese producto si está en results.',
          });
        }

        // Concepto ("carne", "pescado"…): categoría limpia O pool para filtro semántico del LLM
        const conceptBrowse = resolveConceptBrowseForAgent(
          query,
          ctx.products,
          ctx.menuConceptGroups,
        );
        if (conceptBrowse?.products?.length) {
          const max = conceptBrowse.mode === 'semantic_filter' ? 35 : 12;
          return JSON.stringify({
            ok: true,
            query,
            mode: conceptBrowse.mode,
            concept: conceptBrowse.conceptLabel,
            conceptId: conceptBrowse.conceptId,
            candidates: conceptBrowse.products.slice(0, max).map((p) => this.productCard(p)),
            // Alias para prompts viejos
            results: conceptBrowse.products.slice(0, max).map((p) => this.productCard(p)),
            hint: conceptBrowse.hint,
          });
        }

        // Estilo de preparación (“sudado”, “frito”, “asado”…)
        const styleBrowse =
          this.catalogService.extractCookingStyleBrowseIntent(query) ||
          this.catalogService.extractCookingStyleBrowseIntent(`qué tienes ${query}`);
        if (styleBrowse) {
          const styleHits = this.catalogService.findProductsByCookingStyle(
            styleBrowse,
            ctx.products,
            12,
          );
          return JSON.stringify({
            ok: true,
            query,
            mode: 'cooking_style_browse',
            style: styleBrowse,
            results: styleHits.map((p) => this.productCard(p)),
            availableStyles: this.catalogService.listAvailableCookingStyles(ctx.products),
            hint: styleHits.length
              ? `Hay platos con preparación "${styleBrowse}". Lista CADA result (nombre y precio): incluye pescado, porciones y bandeja, no solo varias porciones de pollo. NO add_item.`
              : `No hay "${styleBrowse}" en carta. Di "Por ahora no manejamos ${styleBrowse}" y menciona 2–3 de availableStyles. PROHIBIDO listar todas las categorías.`,
          });
        }

        const scored = scoredEarly.length
          ? scoredEarly
          : this.catalogService.searchByNameScored(query, ctx.products, 6);
        const embedded = this.catalogService.findProductEmbeddedInMessage(query, ctx.products);
        const results = scored.map((x) => this.productCard(x.p));
        if (embedded && !results.some((r) => r.id === embedded.id)) {
          results.unshift(this.productCard(embedded));
        }
        return JSON.stringify({
          ok: true,
          query,
          results: results.slice(0, 6),
          hint:
            results.length === 0
              ? 'Sin coincidencias. Si pidió un plato, di que por ahora no lo manejamos y ofrece el link del menú. ' +
                'Si no es un pedido (queja, saludo, pregunta), respóndelo en una frase. ' +
                'NO set_address si no es un lugar. NO trates la frase completa como nombre de plato.'
              : 'Elige productId de results para add_item.',
        });
      }
      case 'resolve_multi_order': {
        const raw = String(args.text || '').trim();
        if (!raw) return JSON.stringify({ ok: false, error: 'text vacío' });
        const multi = this.catalogService.resolveMultiProductOrder(raw, ctx.products);
        if (!multi) {
          return JSON.stringify({
            ok: false,
            error: 'no_multi',
            hint: 'No parece multi-pedido. Usa search_menu por plato.',
          });
        }
        const card = (p: WhatsappCatalogProduct) => this.productCard(p);
        return JSON.stringify({
          ok: true,
          confident: multi.confident.map((c) => ({
            segment: c.segment,
            ...card(c.product),
            score: c.score,
            quantity: this.catalogService.extractQuantityFromSegment?.(c.segment) || 1,
            selectedAttributes: this.catalogService.resolveAttributesFromMessage?.(c.product, c.segment, []),
            note: c.note,
          })),
          needsAttributes: multi.needsAttributes.map((c) => ({
            segment: c.segment,
            ...card(c.product),
          })),
          ambiguous: multi.ambiguous.map((a) => ({
            segment: a.segment,
            candidates: a.candidates.map(card),
          })),
          unresolved: multi.unresolved,
          hint:
            multi.ambiguous.length || multi.unresolved.length
              ? 'Hay dudas: pregunta UNA sola cosa (número/nombre) por ambiguous; no digas "sí" a la vez. ' +
                'add_item solo de confident/needsAttributes con productId.'
              : 'Multi claro. add_item por cada confident (y needsAttributes con defaults del sistema). Reply corto o vacío.',
        });
      }
      case 'add_item': {
        const productId = Number(args.productId);
        const product = ctx.byId.get(productId);
        if (!product) {
          return JSON.stringify({ ok: false, error: `productId ${productId} no existe` });
        }
        if (product.availableNow === false) {
          return JSON.stringify({ ok: false, error: `"${product.name}" no disponible ahora` });
        }
        const asked =
          this.catalogService.isAvailabilityInquiry(ctx.userMessage || '') ||
          this.catalogService.isCategoryBrowseQuestion(ctx.userMessage || '') ||
          this.catalogService.isProductDescriptionInquiry(ctx.userMessage || '');
        if (asked) {
          return JSON.stringify({
            ok: false,
            error: 'question_not_order',
            hint:
              'Es una pregunta sobre el menú. Responde con lo que devolvió search_menu. No agregues al carrito.',
          });
        }
        const uncovered = this.catalogService.uncoveredWordsAnchoredByProduct(
          ctx.userMessage || '',
          product,
          ctx.products,
        );
        if (uncovered.length) {
          return JSON.stringify({
            ok: false,
            error: 'dish_not_on_menu',
            uncoveredWords: uncovered,
            hint:
              `No agregues "${product.name}": el cliente dijo ${uncovered.join(', ')} y ese plato no lo incluye. ` +
              'Responde que por ahora no lo manejamos, con las palabras del cliente, y el link del menú.',
          });
        }
        // Alimentos incluidos en un plato compuesto no son líneas separadas.
        const txt = (ctx.userMessage || '').toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const isExtraArepas = /porci[oó]n de arepas/i.test(product.name) &&
          /\b(pollos?|broaster)\b/.test(txt) &&
          !/\b(?:porci[oó]n|extra|adicional|aparte)\s+(?:de\s+)?arepas?\b/.test(txt);
        const comboHost = /\b(ejecutivo|combo)\b/.test(txt);
        const explicitlySeparate = /\b(?:aparte|adicional|extra)\b/.test(txt) &&
          this.catalogService.splitMultiProductSegments?.(ctx.userMessage || '').some(segment =>
            /\b(?:aparte|adicional|extra)\b/i.test(segment) &&
            this.catalogService.productNameFitsUtterance?.(product, segment));
        const isComboIncluded = comboHost && !explicitlySeparate && (
          (/^sopa de /i.test(product.name) && /\bsopa\b/.test(txt)) ||
          (/^coca cola/i.test(product.name) && /\bcoca cola\b/.test(txt))
        );
        const isIncludedChicken = /arroz chino con medio pollo/i.test(txt) &&
          /^1\/2 pollo /i.test(product.name) && !/\by\s+(?:otro\s+)?medio\s+pollo\b/.test(txt);
        if (isExtraArepas || isComboIncluded || isIncludedChicken) {
          return JSON.stringify({
            ok: false, error: 'included_attribute_not_extra',
            hint: 'Ya es un atributo o acompañamiento incluido del plato principal. No agregues otra línea sin solicitud explícita.',
          });
        }
        const quantity = Math.min(10, Math.max(1, Number(args.quantity) || 1));
        let note = args.note != null ? String(args.note).trim().slice(0, 200) : undefined;
        let attributes = Array.isArray(args.attributes)
          ? (args.attributes as { attributeName: string; attributeValue: string }[])
          : undefined;

        // Una elección escrita por el cliente prevalece sobre la propuesta
        // del modelo y sobre los valores por defecto del catálogo.
        if (product.attributes?.length && ctx.userMessage?.trim()) {
          const attributeSource = this.catalogService.orderSegmentForProduct?.(
            ctx.userMessage, product, ctx.products,
          ) || ctx.userMessage;
          const parsed = this.catalogService.resolveAttributesFromMessage(
            product, attributeSource, [],
          );
          if (parsed.status === 'complete' || parsed.status === 'partial') {
            const selected = [...(attributes || [])];
            for (const choice of parsed.attributes) {
              const ix = selected.findIndex((a) =>
                a.attributeName.toLowerCase() === choice.attributeName.toLowerCase());
              if (ix >= 0) selected[ix] = choice;
              else selected.push(choice);
            }
            attributes = selected;
          }
        }

        // El LLM no puede inventar atributos. Los cambios de guarnición
        // ("Cambio de papas: por yuca") son NOTAS, no opciones del producto.
        if (attributes?.length) {
          const valid: typeof attributes = [];
          for (const choice of attributes) {
            const declared = (product.attributes || []).find((attr) =>
              attr.attributeName.toLowerCase() === String(choice.attributeName || '').toLowerCase());
            if (!declared) {
              const part = [choice.attributeName, choice.attributeValue].filter(Boolean).join(': ');
              if (part) note = [note, part].filter(Boolean).join('. ').slice(0, 200);
              continue;
            }
            const matched = this.catalogService.matchAttributeOptionValue(
              String(choice.attributeValue || ''), declared.options);
            if (!matched) {
              return JSON.stringify({ ok: false, error: 'invalid_attribute_option',
                hint: 'No reemplaces una elección inválida por la opción predeterminada. Aclara con el cliente.',
                attribute: declared.attributeName, options: declared.options });
            }
            valid.push({ attributeName: declared.attributeName, attributeValue: matched });
          }
          attributes = valid;
        }

        if (product.hasAttributes && product.attributes?.length) {
          let attrs = attributes;
          if (!attrs?.length) {
            attrs = this.catalogService.fillDefaultAttributes(product, []);
          } else {
            const required = product.attributes;
            const hasAll = required.every((def) =>
              attrs!.some(
                (a) =>
                  a.attributeName?.toLowerCase() === def.attributeName.toLowerCase() &&
                  def.options.some(
                    (o) => o.toLowerCase() === a.attributeValue?.trim().toLowerCase(),
                  ),
              ),
            );
            if (!hasAll) {
              attrs = this.catalogService.fillDefaultAttributes(product, attrs);
            }
          }
          attributes = attrs;
        }

        if (!ctx.actions.addItems) ctx.actions.addItems = [];
        ctx.actions.addItems.push({
          productId: product.id,
          quantity,
          note,
          attributes,
        });
        return JSON.stringify({
          ok: true,
          added: this.productCard(product),
          quantity,
          note: note || null,
          attributes: attributes || null,
          hint: attributes?.length
            ? 'Agregado con opciones por defecto. El cliente puede pedir cambiar (ej. arepas fritas).'
            : null,
        });
      }
      case 'remove_item': {
        const productId = Number(args.productId);
        if (!ctx.actions.removeProductIds) ctx.actions.removeProductIds = [];
        if (!ctx.actions.removeProductIds.includes(productId)) {
          ctx.actions.removeProductIds.push(productId);
        }
        return JSON.stringify({ ok: true, removedProductId: productId });
      }
      case 'set_attribute': {
        const productId = Number(args.productId);
        const attributeName = String(args.attributeName || '').trim();
        const attributeValue = String(args.attributeValue || '').trim();
        const product = ctx.byId.get(productId);
        if (!product) {
          return JSON.stringify({ ok: false, error: `productId ${productId} no existe` });
        }
        const attr = (product.attributes || []).find(
          (a) => a.attributeName.toLowerCase() === attributeName.toLowerCase(),
        );
        if (!attr) {
          return JSON.stringify({
            ok: false,
            error: 'ese producto no tiene ese atributo',
            attributes: (product.attributes || []).map((a) => ({
              attributeName: a.attributeName,
              options: a.options,
            })),
          });
        }
        const matched = this.catalogService.matchAttributeOptionValue(
          attributeValue,
          attr.options,
        );
        if (!matched) {
          return JSON.stringify({
            ok: false,
            error: 'opción no existe en ese atributo',
            options: attr.options,
          });
        }
        const line = [...(ctx.cart || [])].reverse().find((c) => c.productId === productId);
        if (!line) {
          return JSON.stringify({ ok: false, error: 'ese producto no está en el carrito' });
        }
        if (!ctx.actions.updateAttributes) ctx.actions.updateAttributes = [];
        ctx.actions.updateAttributes.push({
          productId,
          attributeName: attr.attributeName,
          attributeValue: matched,
        });
        return JSON.stringify({
          ok: true,
          productId,
          itemName: line.name,
          attributeName: attr.attributeName,
          attributeValue: matched,
          hint: 'Cambio aceptado. Confírmalo en una frase. No agregues otro plato.',
        });
      }
      case 'set_address': {
        const address = String(args.address || '').trim();
        if (address.length < 8 || !looksLikeAddressOnlyMessage(address)) {
          return JSON.stringify({
            ok: false,
            error: 'not_a_place',
            hint: 'Eso no es un lugar. Responde al cliente. No guardes domicilio.',
          });
        }
        ctx.actions.setAddress = address.slice(0, 500);
        ctx.actions.setOrderType = 'delivery';
        return JSON.stringify({ ok: true, address: ctx.actions.setAddress });
      }
      case 'set_order_type': {
        const orderType = args.orderType === 'pickup' ? 'pickup' : 'delivery';
        ctx.actions.setOrderType = orderType;
        return JSON.stringify({ ok: true, orderType });
      }
      case 'set_notes': {
        const notes = String(args.notes || '').trim().slice(0, 400);
        if (!notes) return JSON.stringify({ ok: false, error: 'notes vacío' });
        ctx.actions.setCustomerNotes = notes;
        return JSON.stringify({ ok: true, notes });
      }
      case 'clear_cart': {
        ctx.actions.clearCart = true;
        return JSON.stringify({ ok: true });
      }
      case 'request_human': {
        ctx.actions.requestHuman = true;
        return JSON.stringify({ ok: true });
      }
      case 'order_status': {
        const raw = Number(args.orderNumber);
        const orderNumber = Number.isFinite(raw) && raw >= 1 && raw <= 9999 ? raw : undefined;
        ctx.setLookupOrder?.(orderNumber);
        return JSON.stringify({
          ok: true,
          hint: 'Nest responde con el estado real de la orden. No inventes el estado y no reenvíes el carrito.',
        });
      }
      case 'delivery_time': {
        ctx.setLookupDeliveryTime?.();
        return JSON.stringify({
          ok: true,
          hint: 'Nest responde con el tiempo de domicilio configurado. No inventes minutos.',
        });
      }
      default:
        return JSON.stringify({ ok: false, error: `tool desconocida: ${name}` });
    }
  }

  private productCard(p: WhatsappCatalogProduct) {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price,
      category: p.categoryName || null,
      description: (p.description || '').trim().slice(0, 280) || null,
      hasAttributes: !!p.hasAttributes,
      attributes: (p.attributes || []).map((a) => ({
        attributeName: a.attributeName,
        options: a.options,
      })),
    };
  }

  private toChatMessages(
    recent: string[],
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const line of recent) {
      const trimmed = (line || '').trim();
      if (!trimmed) continue;
      if (/^Cliente:\s*/i.test(trimmed)) {
        out.push({ role: 'user', content: trimmed.replace(/^Cliente:\s*/i, '').trim() });
      } else if (/^Bot:\s*/i.test(trimmed)) {
        out.push({ role: 'assistant', content: trimmed.replace(/^Bot:\s*/i, '').trim() });
      } else {
        out.push({ role: 'user', content: trimmed });
      }
    }
    return out.filter((m) => m.content.length > 0);
  }
}
