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
        'Agrega un producto al carrito por id del menú. Si requiere opciones (arepas/bebida), pásalas en attributes o el sistema pedirá al cliente.',
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

    const byId = new Map(input.products.map((p) => [p.id, p]));
    const actions: AiOrderAction = {};
    const toolCalls: string[] = [];
    let needsAttributeProductId: number | undefined;

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
- Si mode="cooking_style_browse": el cliente pidió una *preparación* (sudado, frito, asado…). Lista 2–4 de results o di que no manejamos ese estilo + availableStyles. PROHIBIDO dump de todas las categorías.
- El menú que devuelve search_menu es la única fuente de verdad. Tú analizas, comparas y respondes. No inventes platos, precios ni ingredientes.
- En cada mensaje, primero entiende la intención: preguntar si hay algo, pedir, corregir, saber el precio, saber qué incluye, cambiar lo que ya dijo, domicilio, pago, o seguir con lo que está abierto. Un typo no cambia la intención. Luego search_menu y contesta o actúa solo con lo que la carta permite.
- "¿Tienes X?" / "¿qué tienes de X?" / "¿cómo es X?" vale para cualquier cosa. Lista lo que search_menu sí trae (nombre, precio, qué incluye y preparaciones si las hay) y pregunta cuál quiere. NO add_item. add_item solo si está pidiendo ese plato.
- Pedido de varios platos: la intención es armar ese pedido. Busca cada plato. Di solo el que no está. El resto lo agregas y lo confirmas en una frase, con nombre y precio. No tires la frase entera como si nada existiera.
- Pedido directo ("un churrasco", "quiero una limonada"): add_item en ese mismo turno. No preguntes "¿lo agrego?".
- "sí", "si por favor", "dale" y "ok" confirman. No son el nombre del cliente.
- Corrección en lenguaje normal ("no, yo quería el broaster", "era el otro", "me equivoqué, era la milanesa", "no era ese"): es la intención de cambiar lo que está abierto o en el carrito. Mira la LISTA ABIERTA o la ELECCIÓN PENDIENTE de la sesión y la carta. Corrige con set_attribute, o quita y agrega el plato que sí dijo. No digas que no entendiste. No uses request_human por una corrección.
- "vi la milanesa en el menú" / "sí está en la carta": search_menu de esas palabras, con el typo. Si está, súmala al pedido que ya está abierto y confirma el resto. Si no está, discúlpate, di que no la tenemos, manda el link del menú y sigue con lo que sí quedó. No abras otro plato.
- "no quiero el broaster, quiero el frito", "con ají", "paso a recoger", "hasta dónde llevan", "están abiertos", "no hay promo del día": responde esa intención. Tarifas y horario salen de las reglas, no los inventes. No hay promoción del día: dilo en una frase y pide el plato. El mixto es medio broaster y medio frito.
- "para un domicilio" / "para pedirte un domicilio" sin plato y con carrito vacío: no pidas el nombre. Pregunta qué se le antoja. El nombre va cuando ya hay pedido.
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
    },
  ): string {
    switch (name) {
      case 'search_menu': {
        const query = String(args.query || '').trim();
        if (!query) return JSON.stringify({ ok: false, error: 'query vacío' });

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

        const uncovered = this.catalogService.uncoveredDishWords(query, ctx.products);
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
              'NO el link de la carta. Usa este productId en add_item. No ofrezcas el pollo/sopa sueltos aparte.',
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
              'Hay coincidencia fuerte de producto. Confirma nombre+precio; si preguntan "¿tienen?", di que sí y ofrece agregarlo. ' +
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
              ? `Hay platos/attrs con preparación "${styleBrowse}". Ofrece 2–4 de results (nombre+precio). No dumps de categorías.`
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
        const quantity = Math.min(10, Math.max(1, Number(args.quantity) || 1));
        const note = args.note != null ? String(args.note).trim().slice(0, 200) : undefined;
        let attributes = Array.isArray(args.attributes)
          ? (args.attributes as { attributeName: string; attributeValue: string }[])
          : undefined;

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
