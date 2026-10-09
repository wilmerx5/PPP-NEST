import { Injectable, Logger } from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import {
  WhatsappCatalogService,
  type WhatsappCatalogProduct,
} from './whatsapp-catalog.service';
import type { AiOrderAction } from './types/whatsapp-session.types';
import { applyOpenAiChatCompat } from './whatsapp-openai-compat';
import { requestWhatsappInference } from './whatsapp-openai-request';
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
    quantity?: number;
    note?: string;
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
  { type: 'function' as const, function: {
    name: 'get_cart', description: 'Devuelve cada línea del carrito con índice estable, cantidad, notas y opciones. Consulta antes de editar variantes.',
    parameters: { type: 'object', properties: {} },
  } },
  { type: 'function' as const, function: {
    name: 'update_item', description: 'Modifica cantidad absoluta o nota completa de UNA línea existente. No suma ni agrega productos. note vacío elimina la nota; para añadir una nota conserva la anterior en note.',
    parameters: { type: 'object', properties: {
      productId: { type: 'number' }, cartLineIndex: { type: 'integer', minimum: 0 },
      quantity: { type: 'integer', minimum: 1, maximum: 10 }, note: { type: 'string' },
    }, required: ['productId'] },
  } },
  { type: 'function' as const, function: {
    name: 'replace_item', description: 'Reemplaza UNA línea por otro SKU de la carta conservando cantidad y nota. Por ejemplo jugo en agua por jugo en leche del mismo sabor, o medio frito por medio broaster. Valida el producto nuevo antes de retirar el anterior.',
    parameters: { type: 'object', properties: {
      productId: { type: 'number', description: 'SKU anterior' }, cartLineIndex: { type: 'integer', minimum: 0 },
      newProductId: { type: 'number' }, quantity: { type: 'integer', minimum: 1, maximum: 10 },
      note: { type: 'string', description: 'Nota completa del producto nuevo; vacío la elimina. Si se omite conserva la anterior.' },
      attributes: { type: 'array', items: { type: 'object', properties: {
        attributeName: { type: 'string' }, attributeValue: { type: 'string' },
      }, required: ['attributeName','attributeValue'] } },
    }, required: ['productId','newProductId'] },
  } },
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
          note: { type: 'string', description: 'Nota de cocina o empaque (sin ensalada, bolsa aparte). Las opciones declaradas de preparación, sabor o bebida van en attributes, no en note.' },
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
      description: 'Quita UNA línea existente del carrito. Usa cartLineIndex de get_cart; conserva las otras variantes del mismo producto.',
      parameters: {
        type: 'object',
        properties: { productId: { type: 'number' }, cartLineIndex: { type: 'integer', minimum: 0 } },
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
          cartLineIndex: { type: 'integer', minimum: 0 },
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
  private readonly toolCartIndexes = new WeakMap<AiOrderAction, {
    nextIndex: number; addedIndexes: WeakMap<object, number>;
  }>();
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
    const shortNorm = input.userMessage.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim();
    const allergyContext=shortNorm.replace(/\bno\s+(?:(?:soy|somos|es|son|tengo|tenemos|tiene|tienen|hay)\s+)?(?:alergi(?:a|as|co|ca|cos|cas)|celiac[oa]s?)\b/g,'');
    if(/\b(?:alergi(?:a|as|co|ca|cos|cas)|celiac[oa]s?)\b/.test(allergyContext) ||
      (/\bgarantiz\w*\b/.test(shortNorm) && /\b(?:alergenos?|gluten|lacteos?|leche)\b/.test(shortNorm))) {
      return {reply:'No puedo garantizar la ausencia de alérgenos. Un asesor debe verificar ingredientes y preparación con cocina antes de tomar tu pedido.',
        actions:{requestHuman:true},toolCalls:[]};
    }
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
    const kitchenText = input.userMessage.replace(/^(?:porfa|por\s+favor)\s+/i, '').trim();
    if (input.cart?.length && (looksLikeKitchenSendRequest(kitchenText) ||
      (input.cart.length === 1 && /^(?:sin|m[aá]s)\s+(?:ensalada|cilantro|aj[ií]|salsa)\b/i.test(kitchenText)))) {
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
    // A complete, unambiguous correction of catalog options keeps its SKU.
    // Leave mixed requests and questions to the agent rather than guessing.
    if (input.cart?.length === 1 && !/[?¿]/.test(input.userMessage) &&
      /^(?:mejor|cambia(?:me)?|que sea)\b/.test(shortNorm)) {
      const choices = this.catalogService.listCartAttributeOptionsNamedInText(
        input.userMessage, input.cart, input.products,
      );
      let remaining = ` ${shortNorm} `;
      const normalize = (value: string) => value.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      for (const choice of choices) {
        for (const value of [choice.attributeValue, choice.attributeName]) {
          remaining = remaining.split(` ${normalize(value)} `).join(' ');
        }
      }
      remaining = remaining.replace(/\b(?:mejor|cambia|cambiame|que|sea|el|la|los|las|y|por|a)\b/g, '').trim();
      if (choices.length && !remaining) {
        return {
          reply: 'Listo, cambio ' + choices.map(c => `${c.attributeName}: ${c.attributeValue}`).join(', ') + '. ¿Algo más?',
          actions: { updateAttributes: choices.map(({productId, cartIndex, attributeName, attributeValue}) =>
            ({productId, cartLineIndex: cartIndex, attributeName, attributeValue})) },
          toolCalls: [],
        };
      }
    }
    const actions: AiOrderAction = {};
    const toolCalls: string[] = [];
    let retriedUnappliedOrder = false;
    let retriedIncompleteOrder = false;
    let retriedConciseReply = false;
    let needsAttributeProductId: number | undefined;
    let lookupPlacedOrder: { orderNumber?: number } | undefined;
    let lookupDeliveryTime = false;

    const system = `${cfg.systemPrompt}

Eres el agente de pedidos por WhatsApp de *${input.brandName}*.
NO inventes productos ni precios. Usa tools para buscar y modificar el carrito.
Reglas:
- Siempre search_menu antes de add_item si no tienes el productId. Nunca deduzcas IDs sumando uno ni por el orden de los productos. Antes de replace_item busca SIEMPRE el producto nuevo: productId es el anterior y newProductId es el resultado de esa búsqueda.
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
- En consultas generales como "¿qué hay para almorzar?" o "¿tienen carne?", ofrece 2–3 nombres y precios. No añadas ingredientes ni acompañamientos que el cliente no preguntó.
- Si preguntan qué incluye cada plato, conserva su description individual. No atribuyas a todos el acompañamiento de uno: churrasco y costillas pueden traer cosas distintas. Solo afirma un acompañamiento compartido cuando la carta lo confirma para CADA plato mencionado; si no hay descripción, no inventes.
- En cada mensaje, primero entiende la intención, también si Nest está pidiendo nombre, dirección o pago. Puede ser: preguntar si hay algo, pedir, corregir, saber el precio, saber qué incluye, cambiar lo que ya dijo, domicilio, pago, cómo va un pedido que ya hizo, cuánto tarda un domicilio, o seguir con lo que está abierto. Un typo no cambia la intención. Luego actúa solo con lo que la carta y las tools permiten.
- Si la intención es el estado de un pedido que ya hizo, llama order_status. No es el carrito abierto. No agregues platos y no reenvíes el carrito. Nest dice el estado real.
- Si la intención es cuánto tarda un domicilio en general, llama delivery_time. No inventes minutos.
- "¿Tienes X?" / "¿qué tienes de X?" / "¿cómo es X?" vale para cualquier cosa. Lista lo que search_menu sí trae (nombre, precio, qué incluye y preparaciones si las hay) y pregunta cuál quiere. NO add_item. add_item solo si está pidiendo ese plato.
- "¿Tienes algo de X?" (también "tines", "hay algo de", "te pregunté que si tienes"): pregunta si hay X. Si search_menu no lo trae, di "No tenemos productos de X". X es el producto, sin "algo de", sin "tienes" y sin repetir la frase. No reenvíes el carrito.
- Pedido de varios platos: la intención es armar ese pedido. Busca cada plato. Di solo el que no está. El resto lo agregas y lo confirmas en una frase, con nombre y precio. No tires la frase entera como si nada existiera.
- Pedido directo ("un churrasco", "quiero una limonada"): add_item en ese mismo turno. No preguntes "¿lo agrego?".
- También aplica a varios platos y ejecutivos. No pidas elegir atributos omitidos: add_item rellena los predeterminados. Respeta los explícitos.
- Para el mismo SKU con sabores, preparaciones o notas distintas, llama add_item por cada grupo con su cantidad y atributos/nota. No combines dos sabores ni notes diferentes en una línea.
- Confirma únicamente las cantidades y opciones retornadas por add_item. No inventes otra línea ni opciones distintas para un pedido con opciones omitidas.
- "Tres en total, no tres más" modifica la cantidad existente con update_item; no suma tres unidades. "Arepas aparte" es una nota de empaque: conserva las arepas incluidas, no significa sin arepas ni una porción adicional.
- Solo afirma que agregaste productos después de add_item exitoso. Una búsqueda no modifica el carrito. Ejecuta lo pedido antes de contestar.
- Si una herramienta rechaza una llamada, lee el motivo y cambia la acción. No repitas la misma llamada rechazada. Conserva las acciones exitosas y pregunta solo lo que falta aclarar.
- "sí", "si por favor", "dale", "ok" y "listo" confirman solo cuando el mensaje no dice nada más. No son el nombre del cliente.
- Si la frase trae otra intención (quitar, cambiar, agregar, corregir, preguntar), aunque empiece con "listo" o "ok" y aunque tenga typos: haz esa intención con el carrito y la carta. No confirmes el pedido y no pidas la dirección.
- Ediciones del carrito: usa get_cart. cartLineIndex es el índice de esa línea (empieza en 0), estable durante este turno. Las líneas con el mismo SKU pueden tener distintos sabores/notas. Modifica SOLO la línea nombrada. No llames herramientas para las líneas que el cliente quiere conservar.
- "Deja dos", "que queden dos", "quita uno de tres" ajustan la cantidad absoluta con update_item. No retires y vuelvas a agregar ese SKU.
- Notas de UN plato (sin ensalada, sin cilantro, arepas aparte): update_item con note; conserva la nota previa si pide también otra nota. Para quitar una nota deja las restantes; note="" deja normal. set_notes es SOLO para observaciones generales de todo el pedido.
- Cambio dentro del mismo SKU: set_attribute con cartLineIndex, conserva cantidad y nota. Cambio a otro SKU: replace_item con newProductId real de search_menu y atributos; conserva cantidad/sabor. Leche/agua es la base del jugo y puede ser OTRO SKU, nunca parte inventada de Sabor.
- "Olvida todo lo anterior", "vacía todo y empieza" requiere clear_cart antes de los nuevos productos.
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
- Si el cliente pide otra opción de un producto que YA está en el carrito (bebida, pollo, arepa, presa, sabor), llama set_attribute con productId, cartLineIndex, attributeName y attributeValue de la sesión. Un typo ("roaster") es la opción real más cercana (Broaster) si está en esa lista. NO add_item, NO set_notes y NO digas que no lo manejamos.
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
Líneas editables (cartLineIndex estable): ${JSON.stringify((input.cart || []).map((line,cartLineIndex) => ({cartLineIndex,...line})))}

Índice de SKUs reales y opciones permitidas (id = nombre; opciones omitidas usan el primer valor):\n${input.products.filter(p=>p.availableNow!==false).map(p=>`${p.id} = ${p.name}${(p.attributes || []).map(a=>` [${a.attributeName}: ${a.options.join('/')}]`).join('')}`).join("; ")}\nMenú: usa search_menu para descripción y precio. Link: ${(input.menuUrl || '').trim() || 'menú del local'}
Contacto humano: *${phone || '3118866823'}*
`;

    const history = this.toChatMessages(input.recentMessages).slice(-10);
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: input.userMessage },
    ];

    const model = cfg.openaiModel || 'gpt-4o-mini';
    const turnDeadline = Date.now()+25000;

    try {
      for (let i = 0; i < this.maxIterations; i++) {
        const body = applyOpenAiChatCompat(
          {
            model,
            messages,
            tools: AGENT_TOOLS,
            tool_choice: retriedConciseReply ? 'none' : i===0 && (
              this.catalogService.isAvailabilityInquiry(input.userMessage) ||
              this.catalogService.isPriceInquiryIntent?.(input.userMessage) ||
              this.catalogService.isProductDescriptionInquiry(input.userMessage)
            ) ? {type:'function',function:{name:'search_menu'}} : 'auto',
          },
          {
            model,
            maxOutputTokens: 900,
            temperature: Math.min(0.4, cfg.aiTemperature ?? 0.2),
          },
        );

        const res = await requestWhatsappInference(JSON.stringify(body),cfg.openaiApiKey,
          {timeoutMs:Math.min(20000,turnDeadline-Date.now())});

        if (!res.ok) {
          let code='unclassified';
          try { const value=(await res.json() as {error?:{code?:unknown}}).error?.code;
            if(typeof value==='string' && /^[a-z_]{1,60}$/.test(value)) code=value;
          } catch { /* Never log provider bodies that may echo credentials or input. */ }
          this.logger.error(`AgentV1 OpenAI ${res.status}: ${code}`);
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
          const editsCart = actions.clearCart || actions.removeProductIds?.length || actions.removeCartLines?.length ||
            actions.updateCartLines?.length || actions.updateAttributes?.length || actions.setCustomerNotes || actions.requestHuman;
          const multi = actions.addItems?.length && !editsCart && !this.catalogService.swapIntent(input.userMessage)
            ? this.catalogService.resolveMultiProductOrder?.(input.userMessage,input.products) : null;
          const addedIds = new Set((actions.addItems || []).map(item=>item.productId));
          // A composed dish may be more specific than the multi resolver's
          // component matches. Included options must also never become adds.
          const missing = multi && !multi.ambiguous.length && !multi.unresolved.length && multi.confident.length>=2 &&
            [...addedIds].every(id=>multi.confident.some(item=>item.product.id===id))
            ? multi.confident.filter(item=>!addedIds.has(item.product.id)).filter(item=> {
              const probe = JSON.parse(this.executeTool('add_item',{productId:item.product.id},{
                products:input.products,byId,actions:{},cart:input.cart,userMessage:input.userMessage,
                menuConceptGroups:input.menuConceptGroups,setNeedsAttr:()=>undefined,
              }));
              return probe.ok===true;
            }) : [];
          if (missing.length) {
            if (!retriedIncompleteOrder && i < this.maxIterations-2) {
              retriedIncompleteOrder = true;
              messages.push({role:'system',content:'El pedido múltiple sigue incompleto. Estos platos solicitados y resueltos NO se agregaron: '+
                JSON.stringify(missing.map(item=>({segment:item.segment,...this.productCard(item.product)})))+
                '. Conserva las acciones exitosas; ejecuta add_item solo para los faltantes. No repitas los ya agregados ni afirmes que están todos sin herramientas exitosas.'});
              continue;
            }
            return {reply:'Falta revisar '+missing.map(item=>item.product.name).join(', ')+'. Te ayudo a completar el pedido.',
              actions,toolCalls,error:'incomplete_multi_order'};
          }
          const claimsOrderAdded = /\b(?:he agregado|he añadido|agregu[eé]|añad[ií]|voy a agregar)\b/i.test(reply);
          if (!retriedUnappliedOrder && !actions.addItems?.length && claimsOrderAdded &&
            toolCalls.some(name => name === 'search_menu' || name === 'resolve_multi_order') &&
            !this.catalogService.isAvailabilityInquiry(input.userMessage) &&
            !this.catalogService.isPriceInquiryIntent(input.userMessage) &&
            !this.catalogService.isProductDescriptionInquiry(input.userMessage)) {
            retriedUnappliedOrder = true;
            messages.push({role:'system',content:'Tu respuesta dice que agregaste productos pero no ejecutaste add_item. Una búsqueda no modifica el carrito. Ejecuta add_item para los productos solicitados y resueltos por las tools antes de responder. Si queda una ambigüedad real, pregunta solo por ella y no afirmes cambios que no ejecutaste.'});
            continue;
          }
          if (reply.length > 420 && !retriedConciseReply && i < this.maxIterations - 1) {
            retriedConciseReply = true;
            messages.push({role:'system',content:'Resume tu respuesta anterior en máximo 360 caracteres, con tono cordial. Conserva lo esencial de lo preguntado: nombres y precios o cantidades/opciones efectivamente agregadas. Para una consulta general ofrece 2–3 opciones, sin enumerar atributos ni añadir acompañamientos no preguntados. Si preguntaron qué incluye, conserva las diferencias de cada description: no conviertas acompañamientos distintos en una afirmación sobre todos. No cambies el pedido ni ejecutes más herramientas.'});
            continue;
          }
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
      const name=(err as {name?:string})?.name;
      const code=['TimeoutError','AbortError','TypeError','SyntaxError','Error','RangeError'].includes(name || '')
        ? name : 'UnclassifiedError';
      this.logger.error(`AgentV1 failed: ${code}`);
      return {
        reply: `No pude procesar tu mensaje. Contáctanos al *${phone || '3118866823'}*.`,
        actions,
        toolCalls,
        error: name==='TimeoutError' ? 'openai_timeout' : 'exception',
      };
    }
  }

  /** Project accepted tool actions without moving any existing line index. */
  private toolCartView(ctx: {
    cart?: AgentV1TurnInput['cart']; actions: AiOrderAction;
    byId: Map<number, WhatsappCatalogProduct>;
  }) {
    const actions = ctx.actions;
    let state = this.toolCartIndexes.get(actions);
    if (!state) {
      state = {nextIndex:(ctx.cart || []).length,addedIndexes:new WeakMap()};
      this.toolCartIndexes.set(actions,state);
    }
    const lines = (actions.clearCart ? [] : ctx.cart || []).map((original,cartLineIndex) => {
      const line = {...original,cartLineIndex,pendingAddIndex:-1,
        attributes:original.attributes?.map(a=>({...a})) || []};
      for (const update of actions.updateCartLines || []) {
        if (update.cartLineIndex !== cartLineIndex || update.productId !== line.productId) continue;
        if (update.quantity !== undefined) line.quantity = update.quantity;
        if (update.note !== undefined) line.note = update.note || undefined;
      }
      for (const update of actions.updateAttributes || []) {
        if (update.productId !== line.productId || update.cartLineIndex !== cartLineIndex) continue;
        const old = line.attributes.findIndex(a=>a.attributeName.toLowerCase()===update.attributeName.toLowerCase());
        const attribute = {attributeName:update.attributeName,attributeValue:update.attributeValue};
        if (old < 0) line.attributes.push(attribute);
        else line.attributes[old] = attribute;
      }
      return line;
    }).filter(line => !actions.removeProductIds?.includes(line.productId) &&
      !actions.removeCartLines?.some(r=>r.productId===line.productId && r.cartLineIndex===line.cartLineIndex));
    for (const [pendingAddIndex,item] of (actions.addItems || []).entries()) {
      let cartLineIndex = state.addedI…10692 tokens truncated…
              'Usa currentCart y el cartLineIndex de la línea solicitada; no retires todas las variantes.'});
        }
        const line = matches[0];
        const {cartLineIndex,pendingAddIndex} = line;
        const removeLine = () => {
          if (pendingAddIndex >= 0) ctx.actions.addItems!.splice(pendingAddIndex,1);
          else (ctx.actions.removeCartLines ||= []).push({productId,cartLineIndex});
        };
        if (name === 'remove_item') {
          const normalize = (value:string) => value.toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
          const preserved = (ctx.userMessage || '').split(/[;,.]|\s+y\s+(?=(?:deja|conserva|mant[eé]n|no quites|no cambies)\b)/i).some(clause=> {
            const phrase = normalize(clause);
            if (!/\b(?:deja|conserva|manten|no quites|no lo cambies|no cambies)\b/.test(phrase)) return false;
            const blob = ' '+phrase+' ';
            const product = ctx.byId.get(productId);
            const choices = (product?.attributes || []).flatMap(definition=>definition.options
              .filter(value=>blob.includes(' '+normalize(value)+' '))
              .map(value=>({name:definition.attributeName,value})));
            if (choices.length) return choices.every(choice=>line.attributes?.some(a=>
              normalize(a.attributeName)===normalize(choice.name) && normalize(a.attributeValue)===normalize(choice.value)));
            const notes = (ctx.cart || []).filter(c=>c.productId===productId && !!c.note &&
              blob.includes(' '+normalize(c.note!)+' ')).map(c=>normalize(c.note!));
            if (notes.length) return !!line.note && notes.includes(normalize(line.note));
            return !!product && this.catalogService.findAllProductsEmbeddedInMessage(clause,ctx.products).some(p=>p.id===productId);
          });
          if (preserved) return JSON.stringify({ok:false,error:'customer_requested_preserve_line',cartLineIndex,
            hint:'El cliente pidió conservar esta línea. No la retires; usa update_item si solo cambia su cantidad o nota.'});
          removeLine();
        } else if (name === 'replace_item') {
          if (Number(args.newProductId) === productId) {
            const choices = Array.isArray(args.attributes) ? args.attributes as Array<{attributeName:string;attributeValue:string}> : [];
            const product = ctx.byId.get(productId)!;
            if (choices.some(choice=> {
              const attr=product.attributes?.find(a=>a.attributeName.toLowerCase()===String(choice.attributeName).toLowerCase());
              return !attr || !this.catalogService.matchAttributeOptionValue(String(choice.attributeValue),attr.options);
            })) return JSON.stringify({ok:false,error:'invalid_attribute_option'});
            for (const choice of choices) this.executeTool('set_attribute',{productId,cartLineIndex,...choice},ctx);
            if (args.quantity !== undefined || typeof args.note==='string') {
              const edit=JSON.parse(this.executeTool('update_item',{productId,cartLineIndex,quantity:args.quantity,note:args.note},ctx));
              if(!edit.ok)return JSON.stringify(edit);
            }
            return JSON.stringify({ok:true,productId,cartLineIndex,hint:'Es el mismo SKU; se modificó la línea conservando las otras variantes.'});
          }
          const result = JSON.parse(this.executeTool('add_item', {
            productId:args.newProductId, quantity:args.quantity ?? line.quantity ?? 1,
            note:typeof args.note === 'string' ? args.note : line.note, attributes:args.attributes,
          },ctx));
          if (!result.ok) return JSON.stringify(result);
          removeLine();
          const replacement = this.toolCartView(ctx).find(c=>c.pendingAddIndex === ctx.actions.addItems!.length-1);
          return JSON.stringify({ok:true,replacedProductId:productId,newLine:replacement &&
            {productId:replacement.productId,cartLineIndex:replacement.cartLineIndex,quantity:replacement.quantity,note:replacement.note},
            hint:'Producto reemplazado. Si necesita otra nota edita el newLine.cartLineIndex, o pasa note directamente a replace_item.'});
        } else {
          if (args.quantity !== undefined && (!Number.isInteger(args.quantity) || Number(args.quantity) < 1 || Number(args.quantity) > 10)) {
            return JSON.stringify({ok:false,error:'invalid_quantity'});
          }
          if (args.quantity === undefined && typeof args.note !== 'string') return JSON.stringify({ok:false,error:'missing_change'});
          const update = {productId,cartLineIndex,
            ...(args.quantity !== undefined ? {quantity:Number(args.quantity)} : {}),
            ...(typeof args.note === 'string' ? {note:args.note.trim().slice(0,200)} : {}),
          };
          if (pendingAddIndex >= 0 && typeof args.note === 'string') {
            const product = ctx.byId.get(productId);
            const source = product && this.catalogService.orderSegmentForProduct(ctx.userMessage || '', product, ctx.products);
            const swap = source && this.catalogService.swapIntent(source);
            if (product && swap && this.catalogService.productCarriesMention(product, swap.removed)) {
              update.note = [this.catalogService.extractProductModificationNote(source),
                this.catalogService.swapChangeNote(swap.removed, swap.added)].filter(Boolean).join('. ').slice(0,200);
            }
          }
          if (pendingAddIndex >= 0) {
            const pending = ctx.actions.addItems![pendingAddIndex];
            if (update.quantity !== undefined) pending.quantity = update.quantity;
            if (update.note !== undefined) pending.note = update.note || undefined;
          } else (ctx.actions.updateCartLines ||= []).push(update);
        }
        return JSON.stringify({ok:true,productId,cartLineIndex,hint:'Cambio aceptado. Conserva las otras líneas.'});
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
        if (!matched || (/\b(?:agua|leche)\b/i.test(attributeValue) && !/\b(?:agua|leche)\b/i.test(matched))) {
          return JSON.stringify({
            ok: false,
            error: 'opción no existe en ese atributo',
            options: attr.options,
          });
        }
        const matches = this.toolCartView(ctx).filter(line=>line.productId===productId &&
          (args.cartLineIndex === undefined || line.cartLineIndex===args.cartLineIndex));
        const line = matches.length===1 ? matches[0] : undefined;
        if (!line) {
          return JSON.stringify({ ok: false, error: 'missing_or_ambiguous_cart_line', hint: 'Usa get_cart y el cartLineIndex de la línea solicitada' });
        }
        if (line.attributes?.some(a => a.attributeName.toLowerCase() === attr.attributeName.toLowerCase() && a.attributeValue.toLowerCase() === matched.toLowerCase())) {
          return JSON.stringify({ok:true,unchanged:true,hint:'La línea ya tiene esa opción. No hay ningún cambio.'});
        }
        const cartLineIndex = line.cartLineIndex;
        const update = {productId,cartLineIndex,attributeName:attr.attributeName,attributeValue:matched};
        if (line.pendingAddIndex >= 0) {
          const pending = ctx.actions.addItems![line.pendingAddIndex];
          const attributes = pending.attributes || [];
          const index = attributes.findIndex(a=>a.attributeName.toLowerCase()===attr.attributeName.toLowerCase());
          if (index < 0) attributes.push({attributeName:attr.attributeName,attributeValue:matched});
          else attributes[index] = {attributeName:attr.attributeName,attributeValue:matched};
          pending.attributes = attributes;
        } else (ctx.actions.updateAttributes ||= []).push(update);
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
